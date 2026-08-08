"""DA（Deferred Acceptance / 受入保留方式）アルゴリズム。

対応するマッチング問題:
  - 定員制約付きの多対1マッチング（大学入試、研修医配属など）
  - 各受入者は定員（capacities）まで複数の提案者を受け入れられる

得られる結果は提案者最適な安定マッチング（Gale & Shapley, 1962）。
実行過程は共通イベントスキーマで Result.events に記録する。
"""

from __future__ import annotations

from .events import EventType, MatchingEvent
from .models import DAInput, MatchingResult, build_rank


def deferred_acceptance(data: DAInput) -> MatchingResult:
    """DA アルゴリズムを実行し、提案者最適な安定マッチングを返す。

    入力の選好リストは 1-indexed、返り値のマッチングは 0-indexed
    （models モジュールの docstring を参照）。

    Args:
        data: 選好プロファイルと定員。

    Returns:
        提案者最適な安定マッチング（イベントログ付き）。
    """
    n_proposers = data.n_proposers
    n_receivers = data.n_receivers

    # 受入者の優先順位表（r_rank[j][i] = 受入者 j にとっての提案者 i の順位）
    r_rank = build_rank(data.receiver_prefs, n_proposers)

    proposer_match: list[int] = [-1] * n_proposers
    receiver_match: list[list[int]] = [[] for _ in range(n_receivers)]
    next_proposal: list[int] = [0] * n_proposers  # 次に提案する志望順位
    free: set[int] = set(range(n_proposers))  # 未マッチの提案者
    events: list[MatchingEvent] = []

    round_no = 0
    while free:
        round_no += 1

        # (a) 提案フェーズ: 未マッチの提案者が次の志望先へ提案する
        proposals: list[list[int]] = [[] for _ in range(n_receivers)]
        for p in sorted(free):
            if next_proposal[p] >= len(data.proposer_prefs[p]):
                continue  # 全受入者に提案済み → 未マッチ確定
            r = data.proposer_prefs[p][next_proposal[p]] - 1
            next_proposal[p] += 1
            proposals[r].append(p)
            events.append(
                MatchingEvent(
                    round=round_no,
                    event_type=EventType.PROPOSE,
                    proposer=p,
                    receiver=r,
                )
            )
        free.clear()

        # (b) 受入フェーズ: 各受入者が定員まで仮受入する
        for r in range(n_receivers):
            if not proposals[r]:
                continue

            # 優先順位リストに載っていない提案者は「受け入れ不可能」として即時拒否
            newcomers: list[int] = []
            for p in proposals[r]:
                if r_rank[r][p] >= n_proposers:
                    free.add(p)
                    events.append(
                        MatchingEvent(
                            round=round_no,
                            event_type=EventType.REJECT,
                            proposer=p,
                            receiver=r,
                            reason="受け入れ不可能",
                        )
                    )
                else:
                    newcomers.append(p)
            if not newcomers:
                continue

            # 現在の仮受入者 + 新しい提案者を優先順位順にソートし、定員分だけキープ
            rank_r = r_rank[r]
            candidates = sorted(receiver_match[r] + newcomers, key=rank_r.__getitem__)
            keep = candidates[: data.capacities[r]]
            overflow = candidates[data.capacities[r] :]

            # 仮受入を更新（キープから漏れた提案者は解放して再提案へ）
            for p in receiver_match[r]:
                if p not in keep:
                    proposer_match[p] = -1
                    free.add(p)
                    events.append(
                        MatchingEvent(
                            round=round_no,
                            event_type=EventType.REJECT,
                            proposer=p,
                            receiver=r,
                            reason="定員超過（優先順位の高い提案者に押し出し）",
                        )
                    )
            for p in keep:
                if p in newcomers:
                    events.append(
                        MatchingEvent(
                            round=round_no,
                            event_type=EventType.TENTATIVE_ACCEPT,
                            proposer=p,
                            receiver=r,
                        )
                    )
            receiver_match[r] = list(keep)
            for p in keep:
                proposer_match[p] = r
            for p in overflow:
                if p in newcomers:
                    free.add(p)
                    events.append(
                        MatchingEvent(
                            round=round_no,
                            event_type=EventType.REJECT,
                            proposer=p,
                            receiver=r,
                            reason="定員超過",
                        )
                    )

    return MatchingResult(
        proposer_match=proposer_match,
        receiver_match=receiver_match,
        events=events,
    )
