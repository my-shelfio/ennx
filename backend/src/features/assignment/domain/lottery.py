"""一般化 BvN 分解（期待割当 → 純割当のくじ）。

PS が返す期待割当は分数行列であり、そのままでは配れない。実際に配るには
「制約を満たす確定的な割り当て（純割当）と、それを引く確率」の組に分解する
必要がある。これを保証するのが一般化 BvN 定理（Budish, Che, Kojima and
Milgrom, 2013 の定理 1）であり、本モジュールはその構成的な証明を実装する。

本モジュールは 2 つの使い方を提供する。

- `decompose`: くじを**すべて**列挙する（全分解）。両枝を展開するため項数は最悪
  2^|H| になり、実用規模では現実的でない。教科書規模の例で「くじの全体像」を
  見せるためのもので、上限を超えたら `LotteryTooLargeError` で打ち切る。
- `sample_pure_assignment`: くじを**1 回引く**（原論文の多項式時間アルゴリズム）。
  各分岐で確率 γ に従って片枝だけを辿るため、得られる純割当の分布は全分解と
  厳密に一致する。実際に配るのはこちらで十分で、計算量は分岐の深さに比例する。

手順:
    1. 分数のセルを変数として、整数和の制約を保つ移動方向 d（零空間ベクトル）
       を厳密ガウス消去で求める
    2. d が取れなければ現在の行列は多面体の頂点＝純割当。終了
    3. X + αd と X − βd が実行可能な最大の α, β を取り、γ = β/(α+β) として
       X = γ(X + αd) + (1−γ)(X − βd) に分解する
    4. 両枝を再帰的に分解し、重みを掛け合わせて併合する

各ステップで「新たに和が整数になる制約集合」が 1 つ以上増え、整数だった集合は
整数のままなので、有限回で必ず終了する。ただし本実装は両枝を展開する全分解
であり、項数は最悪 2^|H| になりうるため、上限を超えたら明示的に打ち切る
（論文の多項式時間アルゴリズムは各分岐で乱数を引き、純割当を 1 つだけ
サンプリングする方式）。
"""

from __future__ import annotations

import math
import random
from collections import deque
from dataclasses import dataclass
from fractions import Fraction

from .constraints import (
    ConstraintSet,
    ConstraintStructure,
    find_bihierarchy,
    find_odd_cycle,
    quota_violations,
)
from .models import Cell, LotteryTerm

Matrix = list[list[Fraction]]

# 全分解の項数の上限。低コスト運用の実行時間内に収めるための安全弁。
MAX_LOTTERY_TERMS = 512

# 全分解を試みる分数セル数の上限。これを超えると項数はほぼ確実に上限を超えるため、
# 無駄な探索に時間を使わずに即座に打ち切る（抽選 1 回分は別途成立する）。
MAX_FULL_ENUMERATION_CELLS = 24


class DecompositionError(ValueError):
    """期待割当を純割当のくじに分解できないことを表すドメインエラー。"""


class LotteryTooLargeError(DecompositionError):
    """くじの全列挙が上限を超えたことを表すドメインエラー。

    分解自体は可能で、`sample_pure_assignment` による抽選は成立する。
    呼び出し側は「全体像は出せないが 1 回引くことはできる」場合として扱う。
    """


# 交代閉路の探索で使う仮想頂点。保つべき和が無い側の端をここへ集約する。
_OUTSIDE = -1


@dataclass(frozen=True)
class _SetIndex:
    """制約集合の索引（セル → そのセルを含む制約集合）。

    方向を 1 手動かすたびに全制約集合を走査すると、走査だけで
    (制約集合数 × 手数) に比例する時間がかかる。動かすセルを含まない集合は和が
    変わらないので見る必要がなく、この索引で候補を絞ると計算量が実際に絡み合う
    範囲だけに収まる。

    Attributes:
        sets: 制約集合の一覧（`structure.sets` と同じ順序）。
        by_cell: セル → そのセルを含む制約集合の添字。
    """

    sets: list[ConstraintSet]
    by_cell: dict[Cell, list[int]]

    def affected(self, direction: dict[Cell, Fraction]) -> list[int]:
        """方向が和を変えうる制約集合の添字を返す（重複なし・昇順）。"""
        touched: set[int] = set()
        for cell in direction:
            touched.update(self.by_cell.get(cell, ()))
        return sorted(touched)


def _build_index(structure: ConstraintStructure) -> _SetIndex:
    """制約構造からセル索引を組み立てる（1 回の分解・抽選につき 1 度だけ）。"""
    by_cell: dict[Cell, list[int]] = {}
    for position, cs in enumerate(structure.sets):
        for cell in cs.cells:
            by_cell.setdefault(cell, []).append(position)
    return _SetIndex(sets=list(structure.sets), by_cell=by_cell)


# 抽選 1 回あたりの分岐回数の上限。各分岐で「和が新たに整数になる制約集合」が
# 1 つ以上増えるため理論上は |H| 回で終わるが、実装の不具合で止まらなくなる
# 事態を避けるための安全弁として置く。
_MAX_SAMPLE_STEPS = 100_000


def decompose(matrix: Matrix, structure: ConstraintStructure) -> list[LotteryTerm]:
    """期待割当を、制約を満たす純割当のくじに分解する。

    Args:
        matrix: 期待割当行列（n_agents 行 × n_columns 列）。
        structure: 制約構造（単集合制約を含むこと）。

    Returns:
        くじの項（重みの降順）。重みの総和は 1。

    Raises:
        DecompositionError: 期待割当がクォータを満たさない、または制約構造が
            bihierarchy でない場合。
        LotteryTooLargeError: 項数が上限を超えた場合。
    """
    if len(matrix) != structure.n_agents or any(len(r) != structure.n_columns for r in matrix):
        raise DecompositionError("期待割当行列の形が制約構造と一致しません")

    violations = quota_violations(matrix, structure)
    if violations:
        raise DecompositionError("期待割当が制約を満たしていません: " + " / ".join(violations))

    ensure_decomposable(structure)

    fractional = sum(1 for row in matrix for value in row if value.denominator != 1)
    if fractional > MAX_FULL_ENUMERATION_CELLS:
        raise LotteryTooLargeError(
            f"分数の成分が {fractional} 個あり、くじの全列挙は現実的ではありません"
        )

    terms: list[LotteryTerm] = []
    _decompose(matrix, _build_index(structure), Fraction(1), terms)
    return _merge(terms)


def ensure_decomposable(structure: ConstraintStructure) -> None:
    """制約構造が分解可能（bihierarchy）であることを検証する。

    Raises:
        DecompositionError: bihierarchy でない場合。奇サイクルを検出できた
            ときは、その 3 つ組を理由として添える。
    """
    if find_bihierarchy(structure) is not None:
        return
    message = (
        "制約が互いに交差しているため、期待割当を確定的な割り当てのくじに"
        "分解できません（bihierarchy でない）"
    )
    odd_cycle = find_odd_cycle(structure)
    if odd_cycle:
        labels = "・".join(s.label() for s in odd_cycle)
        message += f"。交差している制約: {labels}"
    raise DecompositionError(message)


def reconstruct(terms: list[LotteryTerm], n_agents: int, n_columns: int) -> Matrix:
    """くじの項から期待割当を再構成する（検証用）。"""
    matrix = [[Fraction(0) for _ in range(n_columns)] for _ in range(n_agents)]
    for term in terms:
        for i in range(n_agents):
            for j in range(n_columns):
                matrix[i][j] += term.weight * term.assignment[i][j]
    return matrix


def verify(terms: list[LotteryTerm], matrix: Matrix, structure: ConstraintStructure) -> list[str]:
    """分解の妥当性を検査し、問題点の一覧を返す（空なら正常）。"""
    problems: list[str] = []
    total = sum((t.weight for t in terms), Fraction(0))
    if total != 1:
        problems.append(f"重みの総和が 1 ではありません: {total}")
    if reconstruct(terms, structure.n_agents, structure.n_columns) != matrix:
        problems.append("再構成した行列が元の期待割当と一致しません")
    for index, term in enumerate(terms, start=1):
        pure: Matrix = [[Fraction(v) for v in row] for row in term.assignment]
        for violation in quota_violations(pure, structure):
            problems.append(f"第 {index} 項が制約違反: {violation}")
    return problems


def sample_pure_assignment(
    matrix: Matrix,
    structure: ConstraintStructure,
    rng: random.Random,
) -> list[list[int]]:
    """期待割当から純割当を 1 つ抽選する（原論文の多項式時間アルゴリズム）。

    全分解と同じ二分割を辿るが、各分岐で確率 γ に従って片方だけを選ぶ。
    得られる純割当の分布は全分解の重みと厳密に一致し、分岐のたびに「和が新たに
    整数になる制約集合」が 1 つ以上増えるため、有限回で純割当に到達する。

    Args:
        matrix: 期待割当行列。
        structure: 制約構造（単集合制約を含むこと）。
        rng: 乱数生成器。同じシードを与えれば同じ純割当が得られる。

    Returns:
        制約を満たす純割当の整数行列。

    Raises:
        DecompositionError: 期待割当がクォータを満たさない、制約構造が
            bihierarchy でない、または分岐が上限回数を超えた場合。
    """
    _ensure_shape(matrix, structure)
    _ensure_quotas(matrix, structure)
    ensure_decomposable(structure)

    index = _build_index(structure)
    current = matrix
    for _ in range(_MAX_SAMPLE_STEPS):
        direction = _find_direction(current, index)
        if direction is None:
            return [[int(value) for value in row] for row in current]

        alpha = _max_step(current, index, direction, 1)
        beta = _max_step(current, index, direction, -1)
        if alpha == 0 and beta == 0:
            raise DecompositionError(
                "移動可能な方向が見つかりませんでした（制約構造を確認してください）"
            )
        gamma = beta / (alpha + beta)
        current = (
            _shift(current, direction, alpha)
            if _draw_below(rng, gamma)
            else _shift(current, direction, -beta)
        )
    raise DecompositionError("抽選が終了しませんでした（制約構造を確認してください）")


def _draw_below(rng: random.Random, threshold: Fraction) -> bool:
    """[0, 1) の一様乱数が threshold 未満かを、有理数のまま判定する。

    浮動小数点数と分数を比較すると丸めで確率がわずかに歪むため、53 ビットの
    乱数を分母 2^53 の分数として扱って比較する。
    """
    return Fraction(rng.getrandbits(53), 1 << 53) < threshold


def _ensure_shape(matrix: Matrix, structure: ConstraintStructure) -> None:
    """行列の形が制約構造と一致することを検証する。"""
    if len(matrix) != structure.n_agents or any(len(row) != structure.n_columns for row in matrix):
        raise DecompositionError("期待割当行列の形が制約構造と一致しません")


def _ensure_quotas(matrix: Matrix, structure: ConstraintStructure) -> None:
    """期待割当がクォータを満たすことを検証する。"""
    violations = quota_violations(matrix, structure)
    if violations:
        raise DecompositionError("期待割当が制約を満たしていません: " + " / ".join(violations))


def _decompose(
    matrix: Matrix,
    index: _SetIndex,
    weight: Fraction,
    out: list[LotteryTerm],
) -> None:
    """行列を再帰的に分解し、純割当と重みを out に積む。"""
    if len(out) >= MAX_LOTTERY_TERMS:
        raise LotteryTooLargeError(f"くじの項数が上限 {MAX_LOTTERY_TERMS} 件を超えました")

    direction = _find_direction(matrix, index)
    if direction is None:
        out.append(LotteryTerm(weight=weight, assignment=[[int(v) for v in row] for row in matrix]))
        return

    alpha = _max_step(matrix, index, direction, 1)
    beta = _max_step(matrix, index, direction, -1)
    if alpha == 0 and beta == 0:
        raise DecompositionError(
            "移動可能な方向が見つかりませんでした（制約構造を確認してください）"
        )

    gamma = beta / (alpha + beta)
    _decompose(_shift(matrix, direction, alpha), index, weight * gamma, out)
    _decompose(_shift(matrix, direction, -beta), index, weight * (1 - gamma), out)


def _find_direction(matrix: Matrix, index: _SetIndex) -> dict[Cell, Fraction] | None:
    """整数セルを固定し、整数和の制約を保つ移動方向を 1 つ返す。無ければ None。

    探索は 2 段構え。

    1. **交代閉路**（`_graph_direction`）: 和が整数の制約を頂点、分数セルを辺とみなす
       グラフに閉路があれば、その上で符号を交互に振るだけで方向になる。各頂点には
       符号の異なる 2 本が接するので、和は変わらない。セル数に比例する時間で済む。
    2. **連立一次方程式**（`_linear_direction`）: 1 つのセルが 3 つ以上の等式に属するなど
       グラフで表せない制約構造では、分数セルを変数とする連立一次方程式を厳密に解く。
       正確だが規模の 3 乗に近い時間がかかるため、あくまで受け皿とする。

    どちらの経路でも、返す前に全ての等式を満たすことを検証する（`_preserves_sums`）。
    """
    free = [
        (i, j)
        for i in range(len(matrix))
        for j in range(len(matrix[0]))
        if matrix[i][j].denominator != 1
    ]
    if not free:
        return None

    is_integral = [cs.total(matrix).denominator == 1 for cs in index.sets]
    direction = _graph_direction(free, index, is_integral)
    if direction is not None:
        return direction
    return _linear_direction(free, index, is_integral)


def _preserves_sums(
    direction: dict[Cell, Fraction], index: _SetIndex, is_integral: list[bool]
) -> bool:
    """方向がすべての等式（和が整数の制約）の和を変えないか。

    方向が触れないセルしか持たない制約集合は和が変わらないため、索引で絞った集合だけ
    確認すれば十分。
    """
    for position in index.affected(direction):
        if not is_integral[position]:
            continue
        total = sum(
            (direction.get(cell, Fraction(0)) for cell in index.sets[position].cells),
            Fraction(0),
        )
        if total != 0:
            return False
    return True


def _graph_direction(
    free: list[Cell], index: _SetIndex, is_integral: list[bool]
) -> dict[Cell, Fraction] | None:
    """交代閉路から方向を求める。グラフで表せない構造なら None。

    各分数セルが属する等式は、標準的な制約構造では「その社員の行」と「その対象の列」の
    高々 2 つになる（列の和が分数なら 1 つだけ）。そこで等式を頂点、セルを辺とする
    多重グラフを作り、閉路上で符号を交互に振れば方向が得られる。等式に属さない側の端は
    仮想頂点 OUTSIDE にまとめる。OUTSIDE には保つべき和が無いので、そこを通る閉路は
    実質「制約されていない 2 つの端を結ぶ道」になる。
    """
    owners: dict[Cell, list[int]] = {}
    for cell in free:
        sets = [position for position in index.by_cell.get(cell, ()) if is_integral[position]]
        if not sets:
            return {cell: Fraction(1)}  # どの等式にも縛られていないセルは単独で動かせる
        if len(sets) > 2:
            return None  # 3 つ以上の等式が絡むとグラフで表せない
        owners[cell] = sets

    adjacency: dict[int, list[tuple[int, Cell]]] = {}
    for cell, sets in owners.items():
        left = sets[0]
        right = sets[1] if len(sets) == 2 else _OUTSIDE
        adjacency.setdefault(left, []).append((right, cell))
        adjacency.setdefault(right, []).append((left, cell))

    cycle = _find_cycle(adjacency)
    if cycle is None:
        return None

    vertices, cells = cycle
    # OUTSIDE には保つべき和が無いので、符号の折り返し（先頭と末尾の境目）をそこへ寄せる。
    if _OUTSIDE in vertices:
        offset = vertices.index(_OUTSIDE)
        cells = cells[offset:] + cells[:offset]

    direction = {
        cell: Fraction(1) if position % 2 == 0 else Fraction(-1)
        for position, cell in enumerate(cells)
    }
    return direction if _preserves_sums(direction, index, is_integral) else None


def _find_cycle(
    adjacency: dict[int, list[tuple[int, Cell]]],
) -> tuple[list[int], list[Cell]] | None:
    """多重グラフから単純閉路を 1 つ返す（頂点列とセル列）。

    幅優先で全域森を作り、木に含まれない辺を 1 本見つけて、その両端から共通祖先まで
    さかのぼる。返す `cells[t]` は `vertices[t]` と `vertices[t + 1]` を結び、最後の
    セルは末尾の頂点と先頭の頂点を結ぶ。
    """
    parent_vertex: dict[int, int] = {}
    parent_cell: dict[int, Cell] = {}
    depth: dict[int, int] = {}

    for root in adjacency:
        if root in depth:
            continue
        depth[root] = 0
        queue = deque([root])
        while queue:
            current = queue.popleft()
            for neighbor, cell in adjacency[current]:
                if neighbor in depth:
                    continue
                depth[neighbor] = depth[current] + 1
                parent_vertex[neighbor] = current
                parent_cell[neighbor] = cell
                queue.append(neighbor)

    tree_cells = set(parent_cell.values())
    for start in adjacency:
        for end, cell in adjacency[start]:
            if cell in tree_cells:
                continue
            return _close_cycle(start, end, cell, parent_vertex, parent_cell, depth)
    return None


def _close_cycle(
    start: int,
    end: int,
    cell: Cell,
    parent_vertex: dict[int, int],
    parent_cell: dict[int, Cell],
    depth: dict[int, int],
) -> tuple[list[int], list[Cell]]:
    """木に含まれない辺 (start, end, cell) が閉じる閉路を組み立てる。"""
    up_vertices: list[int] = [start]
    up_cells: list[Cell] = []
    down_vertices: list[int] = [end]
    down_cells: list[Cell] = []

    left, right = start, end
    while depth[left] > depth[right]:
        up_cells.append(parent_cell[left])
        left = parent_vertex[left]
        up_vertices.append(left)
    while depth[right] > depth[left]:
        down_cells.append(parent_cell[right])
        right = parent_vertex[right]
        down_vertices.append(right)
    while left != right:
        up_cells.append(parent_cell[left])
        left = parent_vertex[left]
        up_vertices.append(left)
        down_cells.append(parent_cell[right])
        right = parent_vertex[right]
        down_vertices.append(right)

    # start → 共通祖先 → end と辿り、最後に cell で start へ戻る。
    vertices = up_vertices + down_vertices[-2::-1]
    cells = up_cells + down_cells[::-1] + [cell]
    return vertices, cells


def _linear_direction(
    free: list[Cell], index: _SetIndex, is_integral: list[bool]
) -> dict[Cell, Fraction] | None:
    """分数セルを変数とする連立一次方程式を厳密に解いて方向を求める。

    探索は分数セルの「連結成分」ごとに行う。和が整数の制約は成分をまたがないため、
    ある成分に閉じた方向は他の成分の制約に影響しない。全分数セルを一度に扱うと
    連立方程式の規模が (社員数 × 列数) まで膨らむのに対し、成分ごとなら実際に
    絡み合っているセルだけで済む。
    """
    integral_sets = [cs for cs, integral in zip(index.sets, is_integral, strict=True) if integral]
    for component in _free_components(free, integral_sets):
        position_of = {cell: k for k, cell in enumerate(component)}
        rows: list[list[Fraction]] = []
        for cs in integral_sets:
            vector = [Fraction(0)] * len(component)
            touched = False
            for cell in cs.cells:
                position = position_of.get(cell)
                if position is not None:
                    vector[position] = Fraction(1)
                    touched = True
            if touched:
                rows.append(vector)

        null_vector = _null_space_vector(rows, len(component))
        if null_vector is None:
            continue
        return {cell: null_vector[k] for k, cell in enumerate(component) if null_vector[k] != 0}
    return None


def _free_components(free: list[Cell], integral_sets: list[ConstraintSet]) -> list[list[Cell]]:
    """分数セルを、和が整数の制約でつながる連結成分に分ける（小さい順）。"""
    parent = {cell: cell for cell in free}

    def find(cell: Cell) -> Cell:
        root = cell
        while parent[root] != root:
            root = parent[root]
        while parent[cell] != root:  # 経路圧縮
            parent[cell], cell = root, parent[cell]
        return root

    for cs in integral_sets:
        members = [cell for cell in cs.cells if cell in parent]
        for cell in members[1:]:
            left, right = find(members[0]), find(cell)
            if left != right:
                parent[left] = right

    groups: dict[Cell, list[Cell]] = {}
    for cell in free:
        groups.setdefault(find(cell), []).append(cell)
    return sorted(groups.values(), key=len)


def _null_space_vector(rows: list[list[Fraction]], n_vars: int) -> list[Fraction] | None:
    """厳密ガウス消去で Ax = 0 の非零解を 1 つ返す。自明解のみなら None。"""
    matrix = [row[:] for row in rows]
    pivot_of_column: dict[int, int] = {}
    pivot_row = 0
    for column in range(n_vars):
        candidate = next((k for k in range(pivot_row, len(matrix)) if matrix[k][column] != 0), None)
        if candidate is None:
            continue
        matrix[pivot_row], matrix[candidate] = matrix[candidate], matrix[pivot_row]
        inverse = matrix[pivot_row][column]
        matrix[pivot_row] = [v / inverse for v in matrix[pivot_row]]
        for k in range(len(matrix)):
            if k != pivot_row and matrix[k][column] != 0:
                factor = matrix[k][column]
                matrix[k] = [
                    v - factor * w for v, w in zip(matrix[k], matrix[pivot_row], strict=True)
                ]
        pivot_of_column[column] = pivot_row
        pivot_row += 1
        if pivot_row == len(matrix):
            break

    free_columns = [c for c in range(n_vars) if c not in pivot_of_column]
    if not free_columns:
        return None
    target = free_columns[0]
    vector = [Fraction(0)] * n_vars
    vector[target] = Fraction(1)
    for column, row_index in pivot_of_column.items():
        vector[column] = -matrix[row_index][target]
    return vector


def _max_step(
    matrix: Matrix, index: _SetIndex, direction: dict[Cell, Fraction], sign: int
) -> Fraction:
    """matrix + sign·t·direction が各制約の床・天井の間に留まる最大の t を返す。

    方向が触れないセルしか持たない制約集合は和が変わらないので、索引で絞った集合だけ
    見れば足りる。
    """
    best: Fraction | None = None
    for position in index.affected(direction):
        cs = index.sets[position]
        delta = sum((direction.get(cell, Fraction(0)) for cell in cs.cells), Fraction(0)) * sign
        if delta == 0:
            continue
        total = cs.total(matrix)
        if delta > 0:
            bound = (Fraction(math.ceil(total)) - total) / delta
        else:
            bound = (Fraction(math.floor(total)) - total) / delta
        best = bound if best is None else min(best, bound)
    return best if best is not None else Fraction(0)


def _shift(matrix: Matrix, direction: dict[Cell, Fraction], step: Fraction) -> Matrix:
    """matrix を direction 方向に step だけ動かした新しい行列を返す。"""
    shifted = [row[:] for row in matrix]
    for (i, j), value in direction.items():
        shifted[i][j] += step * value
    return shifted


def _merge(terms: list[LotteryTerm]) -> list[LotteryTerm]:
    """同一の純割当をまとめ、重みの降順に並べ替える。"""
    bucket: dict[tuple[tuple[int, ...], ...], Fraction] = {}
    for term in terms:
        key = tuple(tuple(row) for row in term.assignment)
        bucket[key] = bucket.get(key, Fraction(0)) + term.weight
    merged = [
        LotteryTerm(weight=weight, assignment=[list(row) for row in key])
        for key, weight in bucket.items()
        if weight != 0
    ]
    merged.sort(key=lambda t: (-t.weight, t.assignment))
    return merged
