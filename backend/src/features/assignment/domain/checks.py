"""期待割当の性質検証ユーティリティ。

PS が保証する性質（Bogomolnaia and Moulin, 2001）:
  1. 水平性     （Equal Treatment of Equals）: 同値な社員の期待割当の行が一致する。
  2. 無羨望性   （sd-Envy-freeness）: 他の社員の期待割当を自分の希望順位のもとで
                 厳密に選好する社員がいない。
  3. 順序効率性 （Ordinal / sd-Efficiency）: 確率を融通し合っても誰も得しない。

PS が保証しない性質:
  4. 耐戦略性   （Strategy-proofness）: 虚偽の希望順位申告で得できるケースが
                 存在する。検証関数は全順序を列挙して再実行するため計算量が
                 大きく、テストからの利用のみを想定する（API では呼ばない）。

順序効率性の判定は「非浪費性 ∧ 関係 τ_P の非巡回性」で行う。τ_P の非巡回性だけで
順序効率性と同値になるのは全供給が完全に配分される設定であり、∅ や余剰供給が
ある本設定では非浪費性の確認を併せて行う必要がある。

**追加の上限制約があるときは、性質の定義そのものが変わる**（教科書第 9 章）。
制約のせいで得られない割当を羨んでも「正当な羨望」ではないし、入れ替えると制約構造が
変わってしまう 2 人は「同値」ではない。本モジュールの判定は次のように制約を織り込む。

  - 水平性  : 希望順位が同じで、かつ 2 人を入れ替えても制約構造が変わらない場合のみ
              「同値」とみなす。
  - 無羨望性: 相手の割当に厳密に確率支配され、かつ 2 人の行の入替が上限制約を
              破らない場合のみ「正当な羨望」とみなす。
  - 順序効率性: 浪費（空きがあり、関係する上限制約にも余地があるのに下位の対象を
              正の確率で得ている状態）は制約付きでも判定できる。一方、改善サイクルの
              網羅的な確認は制約付きでは線形計画を要するため行わない（本番の依存関係を
              最小に保つ方針による）。追加制約があるときは非浪費性までを判定し、
              判定範囲を CheckResult.partial で呼び出し側へ返す。
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

# 耐戦略性の検証で許容する対象数の上限。虚偽申告として (対象数 + 1)! 通りの申告を
# 列挙し、そのたびにメカニズムを再実行するため、対象数が少し増えるだけで実行時間が
# 桁で伸びる。テストからの小規模な検証のみを想定しているので、誤って本番の入力規模で
# 呼ばれたときに待ち続けるのではなく、その場で失敗させる。
MAX_STRATEGY_PROOFNESS_OBJECTS = 6


@dataclass(frozen=True, kw_only=True)
class CheckResult:
    """性質検証の結果。

    Attributes:
        passed: 性質が成立していれば True。
        violations: 違反の説明（成立時は空リスト）。
        partial: 判定が一部にとどまる場合に True（追加制約があるため順序効率性の
            うち非浪費性までしか確認していない、など）。
    """

    passed: bool
    violations: list[str] = field(default_factory=list)
    partial: bool = False

    def __bool__(self) -> bool:
        return self.passed


def check_equal_treatment(data: AssignmentInput, matrix: Matrix) -> CheckResult:
    """水平性: 同値な社員に同じ期待割当が与えられているか。

    同値とは「希望順位が同じ」かつ「2 人を入れ替えても制約構造が変わらない」こと。
    片方だけが NG ペアに指定されている 2 人は、希望順位が同じでも同値ではない。
    """
    violations: list[str] = []
    for i in range(data.n_agents):
        for j in range(i + 1, data.n_agents):
            if data.acceptable(i) != data.acceptable(j):
                continue
            if not _swap_keeps_constraints(data, i, j):
                continue
            if matrix[i] != matrix[j]:
                violations.append(
                    f"{data.a_name(i)} と {data.a_name(j)} は同値だが期待割当が異なる"
                )
    return CheckResult(passed=not violations, violations=violations)


def _swap_keeps_constraints(data: AssignmentInput, i: int, j: int) -> bool:
    """社員 i と j を入れ替えても上限制約の集合が変わらないか。"""
    if not data.constraints:
        return True

    def swap(cell: tuple[int, int]) -> tuple[int, int]:
        agent, obj = cell
        if agent == i:
            return (j, obj)
        if agent == j:
            return (i, obj)
        return cell

    original = {(constraint.cells, constraint.upper) for constraint in data.constraints}
    swapped = {
        (frozenset(swap(cell) for cell in constraint.cells), constraint.upper)
        for constraint in data.constraints
    }
    return original == swapped


def check_envy_free(data: AssignmentInput, matrix: Matrix) -> CheckResult:
    """無羨望性（sd 基準）: 正当な羨望を持つ社員がいないか。

    社員 i が j を正当に羨むのは、i の希望順位のもとで j の割当が i の割当を
    **厳密に**確率支配し、かつ 2 人の行を入れ替えても上限制約を破らないとき。
    制約のせいで手に入らない割当への羨望は、制約を課した時点で織り込み済みとして
    数えない（教科書第 9 章の「正当な羨望」）。
    """
    rank = build_rank(data)
    violations: list[str] = []
    for i in range(data.n_agents):
        for j in range(data.n_agents):
            if i == j:
                continue
            if not _strictly_dominates(matrix[j], matrix[i], rank[i]):
                continue
            if not _swap_is_feasible(data, matrix, i, j):
                continue
            violations.append(
                f"{data.a_name(i)} は {data.a_name(j)} の期待割当を羨む"
                "（入れ替えても制約を破らない）"
            )
    return CheckResult(passed=not violations, violations=violations)


def _swap_is_feasible(data: AssignmentInput, matrix: Matrix, i: int, j: int) -> bool:
    """社員 i と j の行を入れ替えた配分が、すべての上限制約を満たすか。

    列の合計は入替で変わらないため、受け入れ人数は確認しなくてよい。
    """
    for constraint in data.constraints:
        total = Fraction(0)
        for agent, obj in constraint.cells:
            source = j if agent == i else i if agent == j else agent
            total += matrix[source][obj]
        if total > constraint.upper:
            return False
    return True


def check_ordinal_efficiency(data: AssignmentInput, matrix: Matrix) -> CheckResult:
    """順序効率性: 非浪費性と、関係 τ_P の非巡回性が成り立つか。

    追加の上限制約があるときは非浪費性までを判定し、`partial=True` を返す
    （改善サイクルの網羅的な確認は線形計画を要するため）。
    """
    rank = build_rank(data)
    n_columns = data.n_objects + 1
    violations: list[str] = []

    # (1) 非浪費性: 空きがあり、関係する上限制約にも余地がある対象より下位の対象を
    #     正の確率で得ている社員がいないか
    for obj in range(data.n_objects):
        used = sum((matrix[i][obj] for i in range(data.n_agents)), Fraction(0))
        if used >= data.capacities[obj]:
            continue
        for i in range(data.n_agents):
            if rank[i][obj] >= n_columns:
                continue  # 希望していない対象は浪費の対象外
            if not _has_constraint_room(data, matrix, i, obj):
                continue  # 上限制約が塞いでいるなら浪費ではない
            for other in range(n_columns):
                if matrix[i][other] > 0 and rank[i][obj] < rank[i][other]:
                    violations.append(
                        f"浪費: {data.o_name(obj)} に空きがあるのに "
                        f"{data.a_name(i)} は下位の {data.o_name(other)} を正の確率で得ている"
                    )
                    break

    if data.constraints:
        return CheckResult(passed=not violations, violations=violations, partial=True)

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


def _has_constraint_room(data: AssignmentInput, matrix: Matrix, agent: int, obj: int) -> bool:
    """(agent, obj) に関わる上限制約に、まだ余地があるか。"""
    for constraint in data.constraints:
        if (agent, obj) not in constraint.cells:
            continue
        total = sum((matrix[i][j] for (i, j) in constraint.cells), Fraction(0))
        if total >= constraint.upper:
            return False
    return True


def check_strategy_proofness(data: AssignmentInput, mechanism: Mechanism) -> CheckResult:
    """耐戦略性: どの社員も虚偽申告で得できないか（メカニズム単位の性質）。

    各社員について対象の全順序を虚偽申告として列挙し、メカニズムを再実行する。
    計算量は社員数 × (対象数 + 1)! に比例するため、テストでの小規模な検証に限る。
    本番の実行経路（application 層）からは呼ばない。

    Raises:
        ValueError: 対象数が MAX_STRATEGY_PROOFNESS_OBJECTS を超える場合。
    """
    if data.n_objects > MAX_STRATEGY_PROOFNESS_OBJECTS:
        raise ValueError(
            f"耐戦略性の検証は対象 {MAX_STRATEGY_PROOFNESS_OBJECTS} 件までです"
            f"（{data.n_objects} 件）。全ての虚偽申告を列挙するため、"
            "これ以上の規模では現実的な時間で終わりません"
        )
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
    return all(cum_x >= cum_y for cum_x, cum_y in _cumulative_pairs(row_x, row_y, rank))


def _strictly_dominates(row_x: list[Fraction], row_y: list[Fraction], rank: list[int]) -> bool:
    """row_x が row_y を弱確率支配し、かつどこかで厳密に上回るか。"""
    pairs = _cumulative_pairs(row_x, row_y, rank)
    if any(cum_x < cum_y for cum_x, cum_y in pairs):
        return False
    return any(cum_x > cum_y for cum_x, cum_y in pairs)


def _cumulative_pairs(
    row_x: list[Fraction], row_y: list[Fraction], rank: list[int]
) -> list[tuple[Fraction, Fraction]]:
    """希望順位の上位集合ごとの累積確率の組を、好きな順に返す。"""
    order = sorted(range(len(rank)), key=lambda c: (rank[c], c))
    pairs: list[tuple[Fraction, Fraction]] = []
    cum_x = Fraction(0)
    cum_y = Fraction(0)
    for column in order:
        cum_x += row_x[column]
        cum_y += row_y[column]
        pairs.append((cum_x, cum_y))
    return pairs


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
