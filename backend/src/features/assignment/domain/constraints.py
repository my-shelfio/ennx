"""制約構造と bihierarchy 判定（一般化 BvN 定理の前提条件）。

期待割当を純割当のくじに分解できるかどうかは、制約の書き方ではなく制約構造の
形で決まる。制約構造 H は「セル集合 S ごとに整数の下限・上限を与えたもの」で、
1 対 1 の「行和 = 1・列和 = 1」はその特殊ケースにあたる。

  - 階層（laminar family）: 任意の 2 元が入れ子か互いに素
  - bihierarchy: H を 2 つの階層の和に分割できること

定理 1（Budish, Che, Kojima and Milgrom, 2013）: 制約構造が bihierarchy なら、
クォータを満たす任意の期待割当は純割当のくじとして実装できる。
定理 2: 行制約と列制約をすべて含む正準二部制約構造では bihierarchy は必要十分。
補題 1: 制約集合が奇サイクルを成すと実装できない。

bihierarchy の判定は、頂点 = 制約集合・辺 = 交差する組とする交差グラフの
2 彩色（2 部グラフ判定）に帰着でき、BFS で O(|H|^2) で判定できる。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction
from itertools import combinations

from .models import AssignmentInput, Cell

Matrix = list[list[Fraction]]


@dataclass(frozen=True, kw_only=True)
class ConstraintSet:
    """制約集合 S とそのクォータ（下限・上限）。

    Attributes:
        cells: S に含まれるセル（社員 0-index, 対象 0-index）の集合。
        floor: 下限（整数）。
        ceil: 上限（整数）。None は上限なし。
        name: 表示用ラベル。
    """

    cells: frozenset[Cell]
    floor: int = 0
    ceil: int | None = None
    name: str = ""

    def total(self, matrix: Matrix) -> Fraction:
        """行列 matrix における S の和を返す。"""
        return sum((matrix[i][j] for (i, j) in self.cells), Fraction(0))

    def label(self) -> str:
        """表示用ラベル（未設定ならセル集合から生成する）。"""
        return self.name or f"S{sorted(self.cells)}"


@dataclass(frozen=True, kw_only=True)
class ConstraintStructure:
    """制約構造 H（制約集合の族）。

    Attributes:
        n_agents: 社員数。
        n_columns: 列数（対象数 + 1。最終列が ∅）。
        sets: 制約集合の一覧。
    """

    n_agents: int
    n_columns: int
    sets: list[ConstraintSet] = field(default_factory=list)

    def with_singletons(self, floor: int = 0, ceil: int | None = 1) -> ConstraintStructure:
        """すべての単集合 {(i, j)} を（未登録なら）追加した新しい構造を返す。

        「1 人が同じ対象を 2 つ取らない」という暗黙のルールを、他の制約と同じ
        制約集合として明示するためのもの。分解後の純割当が 0/1 行列になることを
        この単集合制約が保証する。
        """
        existing = {cs.cells for cs in self.sets}
        extra = [
            ConstraintSet(
                cells=frozenset({(i, j)}), floor=floor, ceil=ceil, name=f"単集合({i},{j})"
            )
            for i in range(self.n_agents)
            for j in range(self.n_columns)
            if frozenset({(i, j)}) not in existing
        ]
        return ConstraintStructure(
            n_agents=self.n_agents, n_columns=self.n_columns, sets=[*self.sets, *extra]
        )


def row_set(
    agent: int, n_columns: int, floor: int, ceil: int | None, name: str = ""
) -> ConstraintSet:
    """行制約 {agent} × 全列（社員 agent の合計）。"""
    return ConstraintSet(
        cells=frozenset((agent, j) for j in range(n_columns)),
        floor=floor,
        ceil=ceil,
        name=name or f"行{agent}",
    )


def column_set(
    obj: int, n_agents: int, floor: int, ceil: int | None, name: str = ""
) -> ConstraintSet:
    """列制約 全社員 × {obj}（対象 obj の合計）。"""
    return ConstraintSet(
        cells=frozenset((i, obj) for i in range(n_agents)),
        floor=floor,
        ceil=ceil,
        name=name or f"列{obj}",
    )


def build_constraint_structure(data: AssignmentInput) -> ConstraintStructure:
    """割り当て問題の入力を制約構造に変換する。

    1 対 1 の割り当てでは暗黙のルールだったものが、すべて同じ形の制約集合になる:

        各社員ちょうど 1 つ（∅ を含む） → 行制約 [1, 1]
        対象 j の供給数 q_j             → 列制約 [0, q_j]
        追加の上限制約 S                → ConstraintSet(floor=0, ceil=S.upper)
        ∅（未割当）                     → 列制約を課さない（供給無制限）
        1 人が同じ対象を 2 つ取らない   → 単集合制約 [0, 1]

    Args:
        data: 割り当て問題の入力。

    Returns:
        単集合制約まで含んだ制約構造。
    """
    n_agents = data.n_agents
    n_columns = data.n_objects + 1

    sets: list[ConstraintSet] = [
        row_set(i, n_columns, 1, 1, name=f"{data.a_name(i)}（ちょうど 1 つ）")
        for i in range(n_agents)
    ]
    sets += [
        column_set(
            j,
            n_agents,
            0,
            data.capacities[j],
            name=f"{data.o_name(j)}（供給数 {data.capacities[j]}）",
        )
        for j in range(data.n_objects)
    ]
    sets += [
        ConstraintSet(
            cells=constraint.cells, floor=0, ceil=constraint.upper, name=constraint.display_label()
        )
        for constraint in data.constraints
    ]
    return ConstraintStructure(n_agents=n_agents, n_columns=n_columns, sets=sets).with_singletons(
        0, 1
    )


def crosses(left: frozenset[Cell], right: frozenset[Cell]) -> bool:
    """2 つのセル集合が「交差する」（共通部分を持つがどちらも他方を含まない）か。"""
    if left.isdisjoint(right):
        return False
    return not (left <= right or right <= left)


def is_hierarchy(sets: list[ConstraintSet]) -> bool:
    """制約集合の族が階層（laminar family）かどうか。"""
    return not any(crosses(s.cells, t.cells) for s, t in combinations(sets, 2))


def find_bihierarchy(
    structure: ConstraintStructure,
) -> tuple[list[ConstraintSet], list[ConstraintSet]] | None:
    """制約構造を 2 つの階層に分割する。分割できなければ None。

    交差グラフ（頂点 = 制約集合、辺 = 交差する組）が 2 部グラフであることと
    bihierarchy であることは同値。BFS による 2 彩色で判定する。
    """
    sets = structure.sets
    size = len(sets)
    adjacency: list[list[int]] = [[] for _ in range(size)]
    for u, v in combinations(range(size), 2):
        if crosses(sets[u].cells, sets[v].cells):
            adjacency[u].append(v)
            adjacency[v].append(u)

    color = [-1] * size
    for start in range(size):
        if color[start] != -1:
            continue
        color[start] = 0
        queue = [start]
        while queue:
            u = queue.pop()
            for v in adjacency[u]:
                if color[v] == -1:
                    color[v] = 1 - color[u]
                    queue.append(v)
                elif color[v] == color[u]:
                    return None  # 奇数長の閉路 → 2 彩色不能
    return (
        [s for s, c in zip(sets, color, strict=True) if c == 0],
        [s for s, c in zip(sets, color, strict=True) if c == 1],
    )


def find_odd_cycle(structure: ConstraintStructure) -> list[ConstraintSet] | None:
    """長さ 3 の奇サイクルを 1 つ探す。見つかれば分解できない（補題 1）。

    3 つ組 (S1, S2, S3) について S1∩S2\\S3・S2∩S3\\S1・S1∩S3\\S2 のいずれも
    非空なら奇サイクル。長さ 5 以上の奇サイクルは探索しないため、None は
    「奇サイクルが存在しない」ことを意味しない（bihierarchy 判定が正）。
    """
    for s1, s2, s3 in combinations(structure.sets, 3):
        a, b, c = s1.cells, s2.cells, s3.cells
        if (a & b) - c and (b & c) - a and (a & c) - b:
            return [s1, s2, s3]
    return None


def quota_violations(matrix: Matrix, structure: ConstraintStructure) -> list[str]:
    """行列が違反している制約のラベル一覧を返す（空なら適合）。"""
    violations: list[str] = []
    for cs in structure.sets:
        total = cs.total(matrix)
        if total < cs.floor or (cs.ceil is not None and total > cs.ceil):
            upper = "上限なし" if cs.ceil is None else str(cs.ceil)
            violations.append(f"{cs.label()}: 和 = {total} が [{cs.floor}, {upper}] の範囲外")
    return violations
