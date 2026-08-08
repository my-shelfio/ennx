"""FDA（Flexible Deferred Acceptance / 柔軟な受入保留方式）アルゴリズム。

対応するマッチング問題:
  - 地域上限制約付きの多対1マッチング（日本の研修医マッチング等）

定員に加えて「地域（グループ）ごとの受け入れ上限」のような施設をまたいだ制約を扱う
DA の拡張。定員超過の提案者を即座に拒否せず待機リストに載せ、地域上限の余裕を
見ながら輪番方式で繰り上げる（Kamada and Kojima, 2015）。

得られる結果は弱安定マッチング。
実行過程は共通イベントスキーマで Result.events に記録する。
"""

from __future__ import annotations

from .events import EventType, MatchingEvent
from .models import FDAInput, MatchingResult, build_rank


def flexible_deferred_acceptance(data: FDAInput) -> MatchingResult:
    """FDA アルゴリズムを実行し、弱安定マッチングを返す。

    待機リストフェーズは Kamada and Kojima (2015) の定義どおり、
    指名順序（nomination_order）に従って各受入者が待機リストから
    最優先の提案者を「1人ずつ」指名する処理を繰り返す（輪番方式）。

    Args:
        data: 選好プロファイル・定員・設置上限・地域情報。

    Returns:
        弱安定マッチング（イベントログ付き）。
    """
    n_proposers = data.n_proposers
    n_receivers = data.n_receivers

    # 受入者の優先順位表（r_rank[j][i] = 受入者 j にとっての提案者 i の順位）
    r_rank = build_rank(data.receiver_prefs, n_proposers)

    proposer_match: list[int] = [-1] * n_proposers
    receiver_match: list[list[int]] = [[] for _ in range(n_receivers)]
    wait_list: list[list[int]] = [[] for _ in range(n_receivers)]
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

        # (b-1) レギュラーフェーズ: 定員（目標定員）まで仮受入する
        # まず、前ラウンドの繰り上げで目標定員を超えてキープしている提案者を
        # 待機リストへ差し戻す（教科書第4章の定義: レギュラーフェーズは
        # 「すでにキープしている研修医」も含めて目標定員の範囲内でキープし直す）。
        # これにより「レギュラーフェーズ後の地域内キープ数 ≤ 目標定員合計 ≤ 地域上限」
        # が保たれ、待機リストフェーズの地域上限チェックと合わせて実行可能性を保証する。
        for r in range(n_receivers):
            if len(receiver_match[r]) <= data.capacities[r]:
                continue
            rank_r = r_rank[r]
            kept_sorted = sorted(receiver_match[r], key=rank_r.__getitem__)
            receiver_match[r] = kept_sorted[: data.capacities[r]]
            for p in kept_sorted[data.capacities[r] :]:
                proposer_match[p] = -1
                wait_list[r].append(p)
                events.append(
                    MatchingEvent(
                        round=round_no,
                        event_type=EventType.REJECT,
                        proposer=p,
                        receiver=r,
                        reason="目標定員超過（待機リストへ差し戻し）",
                    )
                )
                events.append(
                    MatchingEvent(
                        round=round_no,
                        event_type=EventType.WAITLIST,
                        proposer=p,
                        receiver=r,
                        reason="目標定員超過（待機リストへ差し戻し）",
                    )
                )

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

            # 仮受入を更新（キープから漏れた提案者は待機リスト行きの候補になる）
            for p in receiver_match[r]:
                if p not in keep:
                    proposer_match[p] = -1
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

            # 溢れた提案者を待機リストへ追加（設置上限の範囲内）
            for p in overflow:
                if len(receiver_match[r]) + len(wait_list[r]) < data.max_caps[r]:
                    wait_list[r].append(p)  # 即時拒否せず待機リストへ
                    events.append(
                        MatchingEvent(
                            round=round_no,
                            event_type=EventType.WAITLIST,
                            proposer=p,
                            receiver=r,
                            reason="定員超過（待機リストへ）",
                        )
                    )
                else:
                    free.add(p)
                    events.append(
                        MatchingEvent(
                            round=round_no,
                            event_type=EventType.REJECT,
                            proposer=p,
                            receiver=r,
                            reason=f"設置上限（{data.max_caps[r]}人）超過",
                        )
                    )

        # (b-2) 待機リストフェーズ（輪番方式）
        # 指名順序に従って各受入者が待機リストから最優先の提案者を「1人ずつ」指名し、
        # 地域上限が満員になるか指名できる受入者がいなくなるまで繰り返す。
        regional_count = [0] * len(data.regional_caps)
        for r, matched in enumerate(receiver_match):
            regional_count[data.regions[r]] += len(matched)

        while True:
            any_nominated = False
            for r in data.nomination_order:
                if not wait_list[r]:
                    continue
                region = data.regions[r]
                if regional_count[region] >= data.regional_caps[region]:
                    continue  # 地域上限が満員
                if len(receiver_match[r]) >= data.max_caps[r]:
                    continue  # 設置上限が満員
                # 待機リストから最優先の提案者を「1人だけ」指名し、次の受入者へ
                rank_r = r_rank[r]
                best = min(wait_list[r], key=rank_r.__getitem__)
                wait_list[r].remove(best)
                receiver_match[r].append(best)
                proposer_match[best] = r
                regional_count[region] += 1
                any_nominated = True
                events.append(
                    MatchingEvent(
                        round=round_no,
                        event_type=EventType.PROMOTE,
                        proposer=best,
                        receiver=r,
                        reason="輪番指名による繰り上げ",
                    )
                )
            if not any_nominated:
                break  # この周回で誰も指名できなかった → 待機リストフェーズ終了

        # 指名されずに残った待機リストの提案者は拒否し、次のラウンドへ
        for r in range(n_receivers):
            if not wait_list[r]:
                continue
            region = data.regions[r]
            if regional_count[region] >= data.regional_caps[region]:
                reason = f"地域上限（{data.regional_caps[region]}人）超過"
            else:
                reason = f"設置上限（{data.max_caps[r]}人）超過"
            for p in wait_list[r]:
                free.add(p)
                events.append(
                    MatchingEvent(
                        round=round_no,
                        event_type=EventType.REJECT,
                        proposer=p,
                        receiver=r,
                        reason=reason,
                    )
                )
            wait_list[r] = []

    return MatchingResult(
        proposer_match=proposer_match,
        receiver_match=receiver_match,
        events=events,
    )
