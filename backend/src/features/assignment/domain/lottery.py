"""一般化 BvN 分解（期待割当 → 純割当のくじ）。

PS が返す期待割当は分数行列であり、そのままでは配れない。実際に配るには
「制約を満たす確定的な割り当て（純割当）と、それを引く確率」の組に分解する
必要がある。これを保証するのが一般化 BvN 定理（Budish, Che, Kojima and
Milgrom, 2013 の定理 1）であり、本モジュールはその構成的な証明を実装する。

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
from fractions import Fraction

from .constraints import ConstraintStructure, find_bihierarchy, find_odd_cycle, quota_violations
from .models import Cell, LotteryTerm

Matrix = list[list[Fraction]]

# 全分解の項数の上限。低コスト運用の実行時間内に収めるための安全弁。
MAX_LOTTERY_TERMS = 512


class DecompositionError(ValueError):
    """期待割当を純割当のくじに分解できないことを表すドメインエラー。"""


def decompose(matrix: Matrix, structure: ConstraintStructure) -> list[LotteryTerm]:
    """期待割当を、制約を満たす純割当のくじに分解する。

    Args:
        matrix: 期待割当行列（n_agents 行 × n_columns 列）。
        structure: 制約構造（単集合制約を含むこと）。

    Returns:
        くじの項（重みの降順）。重みの総和は 1。

    Raises:
        DecompositionError: 期待割当がクォータを満たさない、制約構造が
            bihierarchy でない、または項数が上限を超えた場合。
    """
    if len(matrix) != structure.n_agents or any(len(r) != structure.n_columns for r in matrix):
        raise DecompositionError("期待割当行列の形が制約構造と一致しません")

    violations = quota_violations(matrix, structure)
    if violations:
        raise DecompositionError("期待割当が制約を満たしていません: " + " / ".join(violations))

    ensure_decomposable(structure)

    terms: list[LotteryTerm] = []
    _decompose(matrix, structure, Fraction(1), terms)
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


def _decompose(
    matrix: Matrix,
    structure: ConstraintStructure,
    weight: Fraction,
    out: list[LotteryTerm],
) -> None:
    """行列を再帰的に分解し、純割当と重みを out に積む。"""
    if len(out) >= MAX_LOTTERY_TERMS:
        raise DecompositionError(
            f"くじの項数が上限 {MAX_LOTTERY_TERMS} 件を超えました。"
            "社員数・対象数・追加の制約を減らしてください"
        )

    direction = _find_direction(matrix, structure)
    if direction is None:
        out.append(LotteryTerm(weight=weight, assignment=[[int(v) for v in row] for row in matrix]))
        return

    alpha = _max_step(matrix, structure, direction, 1)
    beta = _max_step(matrix, structure, direction, -1)
    if alpha == 0 and beta == 0:
        raise DecompositionError(
            "移動可能な方向が見つかりませんでした（制約構造を確認してください）"
        )

    gamma = beta / (alpha + beta)
    _decompose(_shift(matrix, direction, alpha), structure, weight * gamma, out)
    _decompose(_shift(matrix, direction, -beta), structure, weight * (1 - gamma), out)


def _find_direction(matrix: Matrix, structure: ConstraintStructure) -> dict[Cell, Fraction] | None:
    """整数セルを固定し、整数和の制約を保つ移動方向を 1 つ返す。無ければ None。"""
    free = [
        (i, j)
        for i in range(len(matrix))
        for j in range(len(matrix[0]))
        if matrix[i][j].denominator != 1
    ]
    if not free:
        return None
    index = {cell: k for k, cell in enumerate(free)}

    rows: list[list[Fraction]] = []
    for cs in structure.sets:
        if cs.total(matrix).denominator != 1:
            continue  # 和が分数の制約は動かしてよい
        vector = [Fraction(0)] * len(free)
        touched = False
        for cell in cs.cells:
            if cell in index:
                vector[index[cell]] = Fraction(1)
                touched = True
        if touched:
            rows.append(vector)

    null_vector = _null_space_vector(rows, len(free))
    if null_vector is None:
        return None
    return {cell: null_vector[k] for k, cell in enumerate(free) if null_vector[k] != 0}


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
    matrix: Matrix, structure: ConstraintStructure, direction: dict[Cell, Fraction], sign: int
) -> Fraction:
    """matrix + sign·t·direction が各制約の床・天井の間に留まる最大の t を返す。"""
    best: Fraction | None = None
    for cs in structure.sets:
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
