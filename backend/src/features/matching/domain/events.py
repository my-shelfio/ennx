"""マッチングアルゴリズム共通のイベントログ（ステップログ）。

アルゴリズム実行時の各ラウンドの状態変化を構造化イベントとして記録する。
イベントスキーマは DA・FDA・CA の3アルゴリズム共通。

イベントログは過程可視化機能（M4）の中核であり、reconstruct_matching により
イベント列だけから最終マッチング結果を再構成できることを保証する。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class EventType(StrEnum):
    """イベント種別。

    共通（DA・FDA・CA）:
        PROPOSE: 提案者が受入者に提案した（CA では需要に含まれたことを表す）。
        TENTATIVE_ACCEPT: 受入者が提案者を仮受入した（最終ラウンドでは確定受入）。
        REJECT: 受入者が提案者を拒否した。
    FDA 固有:
        WAITLIST: 定員超過の提案者を待機リストに載せた。
        PROMOTE: 待機リストの提案者を輪番指名で繰り上げた。
    CA 固有:
        CUTOFF_RAISE: 制約超過によりカットオフを引き上げた。
    """

    PROPOSE = "propose"
    TENTATIVE_ACCEPT = "tentative_accept"
    REJECT = "reject"
    WAITLIST = "waitlist"
    PROMOTE = "promote"
    CUTOFF_RAISE = "cutoff_raise"


@dataclass(frozen=True, kw_only=True)
class MatchingEvent:
    """アルゴリズム実行過程の1つの状態変化。

    Attributes:
        round: ラウンド番号（1 始まり）。DA・FDA では提案〜受入の1巡、
            CA ではカットオフ調整の1反復に対応する。
        event_type: イベント種別。
        proposer: 対象の提案者（0-indexed）。CUTOFF_RAISE では None。
        receiver: 対象の受入者（0-indexed）。
        reason: 補足説明（拒否理由など）。省略可。
    """

    round: int
    event_type: EventType
    proposer: int | None
    receiver: int
    reason: str | None = None


def reconstruct_matching(
    events: list[MatchingEvent],
    n_proposers: int,
    n_receivers: int,
) -> tuple[list[int], list[set[int]]]:
    """イベントログから最終マッチング結果を再構成する。

    再構成ルール:
        - TENTATIVE_ACCEPT / PROMOTE: 提案者を受入者に割り当てる。
        - REJECT: 提案者がその受入者に割り当て済みであれば解除する。
        - PROPOSE / WAITLIST / CUTOFF_RAISE: 割り当て状態を変化させない。

    Args:
        events: 実行順のイベント列。
        n_proposers: 提案者数。
        n_receivers: 受入者数。

    Returns:
        (proposer_match, receiver_match) のタプル。
        proposer_match[i] はマッチした受入者の 0-index（-1 = 未マッチ）、
        receiver_match[j] はマッチした提案者の 0-index 集合。
    """
    proposer_match = [-1] * n_proposers
    receiver_match: list[set[int]] = [set() for _ in range(n_receivers)]

    for event in events:
        if event.event_type in (EventType.TENTATIVE_ACCEPT, EventType.PROMOTE):
            if event.proposer is None:
                raise ValueError(f"{event.event_type} イベントには proposer が必要です")
            # 別の受入者に割り当て済みなら付け替える
            old = proposer_match[event.proposer]
            if old != -1:
                receiver_match[old].discard(event.proposer)
            proposer_match[event.proposer] = event.receiver
            receiver_match[event.receiver].add(event.proposer)
        elif event.event_type is EventType.REJECT:
            if event.proposer is None:
                raise ValueError("reject イベントには proposer が必要です")
            if proposer_match[event.proposer] == event.receiver:
                proposer_match[event.proposer] = -1
                receiver_match[event.receiver].discard(event.proposer)

    return proposer_match, receiver_match
