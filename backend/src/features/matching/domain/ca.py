"""CA（Cutoff Adjustment / カットオフ調整）アルゴリズム。

対応するマッチング問題:
  - 一般上限制約付きの多対1マッチング（保育園マッチング等）

理論的背景:
  - カットオフ: 各受入者の「足切りライン」。市場価格に相当する。
  - 需要 D_r(p): カットオフ p のもとで受入者 r を希望する提案者の集合。
  - 調整関数 T: 需要が制約を超える受入者のカットオフを +1 する。
  - T の最小不動点（タルスキの不動点定理）= 提案者最適公平マッチング。

理論的前提（重要）:
  - 各制約は「遺伝性（hereditary）」を満たす一般上限制約であること。すなわち、
    実行可能な提案者集合の任意の部分集合もまた実行可能であること
    （とくに空集合は常に実行可能）。定員・予算・回避（NGペア分離）などの
    上限制約はいずれも遺伝性を満たす。
  - 遺伝性を満たさない制約（「最低◯人」などの下限制約）を渡すと、
    カットオフ調整が収束しない、または誤った結果を返すことがあり、対象外。
  - CA が提案者最適公平マッチングを返すことの理論的根拠は
    Kamada and Kojima (2024) "Fair Matching under Constraints: Theory and
    Applications," Review of Economic Studies, 91(2), pp.1162-1199。

実行過程は共通イベントスキーマで Result.events に記録する。
"""

from __future__ import annotations

from .events import EventType, MatchingEvent
from .models import CAInput, CAResult, Constraint, build_rank


def capacity_constraint(cap: int) -> Constraint:
    """定員制約: |I'| <= cap を表す制約関数を返す。"""
    return lambda proposers: len(proposers) <= cap


def budget_constraint(costs: dict[int, float], budget: float) -> Constraint:
    """予算制約: Σ cost_i <= budget を表す制約関数を返す。

    Args:
        costs: costs[提案者番号（0-indexed）] = コスト のマッピング。
        budget: 予算の上限。
    """
    return lambda proposers: sum(costs.get(p, 0.0) for p in proposers) <= budget


def collision_avoidance_constraint(conflict_pairs: list[tuple[int, int]]) -> Constraint:
    """回避制約: NGペアが同じ受入者に配属されないことを保証する制約関数を返す。

    Args:
        conflict_pairs: 同じ受入先に配属してはならない 0-indexed 提案者ペアのリスト。
    """
    return lambda proposers: not any(a in proposers and b in proposers for a, b in conflict_pairs)


def all_constraints(constraints: list[Constraint]) -> Constraint:
    """任意個の制約を合成した複合制約を返す。

    すべての制約を同時に満たす場合のみ実行可能と判定する。各制約が遺伝性を満たす
    上限制約であれば、合成後の制約も遺伝性を満たす（空集合は全制約が実行可能と
    判定するため、合成後も実行可能）。
    """

    def _combined(proposers: frozenset[int]) -> bool:
        return all(constraint(proposers) for constraint in constraints)

    return _combined


def combined_constraint(cap: int, conflict_pairs: list[tuple[int, int]]) -> Constraint:
    """定員制約と回避制約を組み合わせた複合制約を返す（互換用。内部は all_constraints）。

    両条件を同時に満たす場合のみ実行可能と判定する:
      1. 提案者集合のサイズが cap 以下
      2. conflict_pairs のいずれのペアも同時に含まない
    """
    return all_constraints(
        [capacity_constraint(cap), collision_avoidance_constraint(conflict_pairs)]
    )


def cutoff_adjustment(data: CAInput) -> CAResult:
    """CA アルゴリズムを実行し、提案者最適公平マッチングを返す。

    最小カットオフ p = (1, ..., 1) から出発し、カットオフ調整関数 T の
    最小不動点 p* を求める。p* のもとで需要 D_r(p*) を確定させたものが
    提案者最適公平マッチングとなる。

    前提: data.constraints の各制約は遺伝性を満たす上限制約であること
    （モジュール docstring 参照）。下限制約は扱えない。

    Args:
        data: 選好プロファイルと受入者ごとの制約関数。

    Returns:
        提案者最適公平マッチング（最終カットオフ・イベントログ付き）。
    """
    n_proposers = data.n_proposers
    n_receivers = data.n_receivers

    # 受入者の優先順位表（priority_rank[r][p] = 受入者 r にとっての提案者 p の順位）
    priority_rank = build_rank(data.receiver_prefs, n_proposers)

    # 最小カットオフから開始（すべての提案者を対象に含める）
    cutoff = [1] * n_receivers
    events: list[MatchingEvent] = []

    iteration = 0
    while True:
        iteration += 1

        # 需要 D_r(p) を計算し、イベントに記録する
        demand = _compute_demand(data, cutoff, priority_rank)
        for r in range(n_receivers):
            for p in demand[r]:
                events.append(
                    MatchingEvent(
                        round=iteration,
                        event_type=EventType.PROPOSE,
                        proposer=p,
                        receiver=r,
                        reason=f"カットオフ {cutoff[r]} のもとで需要に含まれる",
                    )
                )

        # カットオフ調整関数 T(p) を計算
        new_cutoff = list(cutoff)
        is_fixed_point = True
        for r in range(n_receivers):
            feasible = data.constraints[r](frozenset(demand[r]))
            if not feasible:
                new_cutoff[r] = cutoff[r] + 1
                is_fixed_point = False
                events.append(
                    MatchingEvent(
                        round=iteration,
                        event_type=EventType.CUTOFF_RAISE,
                        proposer=None,
                        receiver=r,
                        reason=(
                            f"制約超過によりカットオフを {cutoff[r]} → {new_cutoff[r]} に引き上げ"
                        ),
                    )
                )

        if is_fixed_point:
            break

        cutoff = new_cutoff

        # 安全装置: すべての受入者でカットオフが提案者数+1 を超えたら終了
        if all(c > n_proposers for c in cutoff):
            break

    # 最終マッチングを確定（不動点 p* のもとでの需要）
    demand = _compute_demand(data, cutoff, priority_rank)
    proposer_match = [-1] * n_proposers
    receiver_match: list[list[int]] = [[] for _ in range(n_receivers)]

    for r in range(n_receivers):
        receiver_match[r] = sorted(demand[r])
        for p in demand[r]:
            proposer_match[p] = r
            events.append(
                MatchingEvent(
                    round=iteration,
                    event_type=EventType.TENTATIVE_ACCEPT,
                    proposer=p,
                    receiver=r,
                    reason="不動点カットオフのもとで確定受入",
                )
            )

    return CAResult(
        proposer_match=proposer_match,
        receiver_match=receiver_match,
        cutoff_profile=cutoff,
        events=events,
    )


def _compute_demand(
    data: CAInput,
    cutoff: list[int],
    priority_rank: list[list[int]],
) -> list[list[int]]:
    """カットオフ p のもとで各受入者の需要 D_r(p) を計算する。

    D_r(p) = { i | i が受入者 r の足切りを通過し、r が i にとって
               最も好ましい「足切り通過受入者」である }

    足切り通過の条件（cutoff[r]=1 で全員通過、cutoff[r]=P+1 で全員除外）:
      priority_rank[r][i] <= P - cutoff[r]
    """
    n_proposers = data.n_proposers
    n_receivers = data.n_receivers

    # 各受入者の足切り通過者集合を求める
    qualified: list[set[int]] = [set() for _ in range(n_receivers)]
    for r in range(n_receivers):
        threshold = n_proposers - cutoff[r]  # この値以下の順位を持つ提案者が通過
        for p in range(n_proposers):
            if priority_rank[r][p] <= threshold:
                qualified[r].add(p)

    # 各提案者が最も好きな「足切り通過受入者」を求め、そこに振り分ける
    demand: list[list[int]] = [[] for _ in range(n_receivers)]
    for p in range(n_proposers):
        for r_1indexed in data.proposer_prefs[p]:
            r = r_1indexed - 1
            if p in qualified[r]:
                demand[r].append(p)
                break  # 最も好きな通過受入者に割り当て、残りはスキップ

    return demand
