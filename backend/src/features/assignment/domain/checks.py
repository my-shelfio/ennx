"""期待割当の性質検証ユーティリティ。

PS が保証する性質（Bogomolnaia and Moulin, 2001）:
  1. 水平性     （Equal Treatment of Equals）: 同じ希望順位を申告した社員の
                 期待割当の行が一致する。
  2. 無羨望性   （sd-Envy-freeness）: 各社員の期待割当が、他の社員の期待割当を
                 自分の希望順位のもとで弱確率支配する。
  3. 順序効率性 （Ordinal / sd-Efficiency）: 確率を融通し合っても誰も得しない。

PS が保証しない性質:
  4. 耐戦略性   （Strategy-proofness）: 虚偽の希望順位申告で得できるケースが
                 存在する。検証関数は全順序を列挙して再実行するため計算量が
                 大きく、テストからの利用のみを想定する（API では呼ばない）。

順序効率性の判定は「非浪費性 ∧ 関係 τ_P の非巡回性」で行う。τ_P の非巡回性だけで
順序効率性と同値になるのは全供給が完全に配分される設定であり、∅ や余剰供給が
ある本設定では非浪費性の確認を併せて行う必要がある。
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from fractions import Fraction
from itertools import permutations

from .models import AssignmentInput, AssignmentResult, build_rank

Matrix = list[list[Fraction]]

# メカニズム = 入力を受け取り期待割当を返す関数（耐戦略性の検証で再実行する）
Mechanism = Callable[[AssignmentInput], AssignmentResult]


@dataclass(frozen=True, kw_only=True)
class CheckResult:
    """性質検証の結果。

    Attributes:
        passed: 性質が成立していれば True。
        violations: 違反の説明（成立時は空リスト）。
    """

    passed: bool
    violations: list[str] = field(default_factory=list)

    def __bool__(self) -> bool:
        return self.passed


def check_equal_treatment(data: AssignmentInput, matrix: Matrix) -> CheckResult:
    """水平性: 同じ希望順位を申告した社員に同じ期待割当が与えられているか。"""
    violations: list[str] = []
    groups: dict[tuple[int, ...], list[int]] = {}
    for i in range(data.n_agents):
        groups.setdefault(tuple(data.acceptable(i)), []).append(i)

    for members in groups.values():
        base = members[0]
        for other in members[1:]:
            if matrix[base] != matrix[other]:
                violations.append(
                    f"{data.a_name(base)} と {data.a_name(other)} は同じ希望順位だが"
                    "期待割当が異なる"
                )
    return CheckResult(passed=not violations, violations=violations)


def check_envy_free(data: AssignmentInput, matrix: Matrix) -> CheckResult:
    """無羨望性（sd 基準）: 各社員が自分の期待割当で他人の期待割当を弱確率支配するか。"""
    rank = build_rank(data)
    violations: list[str] = []
    for i in range(data.n_agents):
        for j in range(data.n_agents):
            if i == j:
                continue
            if not _weakly_dominates(matrix[i], matrix[j], rank[i]):
                violations.append(
                    f"{data.a_name(i)} は {data.a_name(j)} の期待割当を羨む"
                    "（自分の割当が相手を確率支配しない）"
                )
    return CheckResult(passed=not violations, violations=violations)


def check_ordinal_efficiency(data: AssignmentInput, matrix: Matrix) -> CheckResult:
    """順序効率性: 非浪費性と関係 τ_P の非巡回性の両方が成り立つか。"""
    rank = build_rank(data)
    n_columns = data.n_objects + 1
    violations: list[str] = []

    # (1) 非浪費性: 余剰供給のある対象より下位の対象を正の確率で消費していないか
    for obj in range(data.n_objects):
        used = sum((matrix[i][obj] for i in range(data.n_agents)), Fraction(0))
        if used >= data.capacities[obj]:
            continue
        for i in range(data.n_agents):
            if rank[i][obj] >= n_columns:
                continue  # 受け入れ不可能な対象は浪費の対象外
            for other in range(n_columns):
                if matrix[i][other] > 0 and rank[i][obj] < rank[i][other]:
                    violations.append(
                        f"浪費: {data.o_name(obj)} に空きがあるのに "
                        f"{data.a_name(i)} は下位の {data.o_name(other)} を正の確率で得ている"
                    )
                    break

    # (2) 改善サイクル: a→b ⟺ ある社員が a を正の確率で得ており、かつ b を a より好む
    adjacency: dict[int, set[int]] = {c: set() for c in range(n_columns)}
    for i in range(data.n_agents):
        for a in range(n_columns):
            if matrix[i][a] <= 0:
                continue
            for b in range(n_columns):
                if rank[i][b] < rank[i][a]:
                    adjacency[a].add(b)

    cycle = _find_cycle(adjacency, n_columns)
    if cycle is not None:
        path = " → ".join(data.o_name(c) for c in cycle)
        violations.append(f"確率を交換すれば全員が得できる改善サイクルが存在する: {path}")
    return CheckResult(passed=not violations, violations=violations)


def check_strategy_proofness(data: AssignmentInput, mechanism: Mechanism) -> CheckResult:
    """耐戦略性: どの社員も虚偽申告で得できないか（メカニズム単位の性質）。

    各社員について対象の全順序を虚偽申告として列挙し、メカニズムを再実行する。
    計算量は社員数 × (対象数 + 1)! に比例するため、テストでの小規模な検証に限る。
    """
    rank = build_rank(data)
    truthful = mechanism(data).expected_assignment
    violations: list[str] = []
    all_reports = _all_reports(data.n_objects)

    for i in range(data.n_agents):
        honest = data.acceptable(i)
        for report_prefs in all_reports:
            if [o - 1 for o in report_prefs] + [data.empty_index] == honest:
                continue
            misreported = AssignmentInput(
                agent_prefs=[
                    *data.agent_prefs[:i],
                    report_prefs,
                    *data.agent_prefs[i + 1 :],
                ],
                capacities=data.capacities,
                constraints=data.constraints,
                agent_names=data.agent_names,
                object_names=data.object_names,
            )
            manipulated = mechanism(misreported).expected_assignment
            if not _weakly_dominates(truthful[i], manipulated[i], rank[i]):
                names = "、".join(data.o_name(o - 1) for o in report_prefs) or "何も希望しない"
                violations.append(f"{data.a_name(i)} は虚偽申告（{names}）で得できる可能性がある")
                break
    return CheckResult(passed=not violations, violations=violations)


def _all_reports(n_objects: int) -> list[list[int]]:
    """虚偽申告として試す希望順位リスト（1-indexed）の全パターンを返す。

    対象と ∅ の全順序を列挙し、∅ 以降を切り捨てたもの（= 受け入れ可能な対象の
    並び）を重複なく返す。∅ を先頭に置く申告（何も希望しない）も含む。
    """
    reports: list[list[int]] = []
    seen: set[tuple[int, ...]] = set()
    for order in permutations(range(n_objects + 1)):
        acceptable: list[int] = []
        for value in order:
            if value == n_objects:  # ∅ に到達したら以降は受け入れ不可能
                break
            acceptable.append(value + 1)
        key = tuple(acceptable)
        if key not in seen:
            seen.add(key)
            reports.append(acceptable)
    return reports


def _weakly_dominates(row_x: list[Fraction], row_y: list[Fraction], rank: list[int]) -> bool:
    """rank（ある社員の希望順位）のもとで row_x が row_y を弱確率支配するか。

    希望順位の上位集合すべてについて、累積確率が row_x ≥ row_y であれば True。
    """
    order = sorted(range(len(rank)), key=lambda c: (rank[c], c))
    cum_x = Fraction(0)
    cum_y = Fraction(0)
    for column in order:
        cum_x += row_x[column]
        cum_y += row_y[column]
        if cum_x < cum_y:
            return False
    return True


def _find_cycle(adjacency: dict[int, set[int]], n_nodes: int) -> list[int] | None:
    """有向グラフに閉路があれば、そのノード列を 1 つ返す。なければ None。"""
    white, gray, black = 0, 1, 2
    color = [white] * n_nodes
    stack: list[int] = []

    def visit(node: int) -> list[int] | None:
        color[node] = gray
        stack.append(node)
        for neighbor in sorted(adjacency[node]):
            if color[neighbor] == gray:
                return stack[stack.index(neighbor) :] + [neighbor]
            if color[neighbor] == white:
                found = visit(neighbor)
                if found is not None:
                    return found
        stack.pop()
        color[node] = black
        return None

    for node in range(n_nodes):
        if color[node] == white:
            found = visit(node)
            if found is not None:
                return found
    return None
