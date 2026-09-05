"""割り当て問題（PS メカニズム）のイベントログ（ステップログ）。

PS のイーティング過程は連続時間で進み、ラウンドではなく「時刻の区間」を単位と
する。そのため matching 機能の `MatchingEvent`（`round: int` を持つ離散イベント）
とはスキーマを共有せず、本モジュールで独立に定義する。

イベント列だけから期待割当行列を再構成できることを
`reconstruct_expected_assignment` で保証する（テストで検証）。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from fractions import Fraction

# 未割当（∅）を表す列は、対象の 0-index の次に置く仮想列とする。
# 期待割当行列の列数は n_objects + 1 で、最終列が ∅ に対応する。


class AssignmentEventType(StrEnum):
    """イベント種別。

    CONSUME: 区間 [start, end) で社員が対象（∅ を含む）を一定速度で消費した。
    SUPPLY_EXHAUSTED: 時刻 end で対象の供給数が消費し尽くされた。
    CONSTRAINT_SATURATED: 時刻 end で上限制約が上限に達した。
    """

    CONSUME = "consume"
    SUPPLY_EXHAUSTED = "supply_exhausted"
    CONSTRAINT_SATURATED = "constraint_saturated"


@dataclass(frozen=True, kw_only=True)
class AssignmentEvent:
    """イーティング過程の 1 イベント。

    Attributes:
        step: 区間番号（1 始まり）。同じ step のイベントは同一の時刻区間に属する。
        event_type: イベント種別。
        start: 区間の開始時刻（0 以上 1 以下の分数）。
        end: 区間の終了時刻（0 以上 1 以下の分数）。
        agent: 対象の社員（0-indexed）。consume 以外では None。
        obj: 対象の 0-index（∅ は n_objects）。constraint_saturated では None。
        amount: 区間で消費した量（end - start）。consume 以外では None。
        constraint_index: 飽和した上限制約の 0-index。
            constraint_saturated 以外では None。
        reason: 補足説明。省略可。
    """

    step: int
    event_type: AssignmentEventType
    start: Fraction
    end: Fraction
    agent: int | None = None
    obj: int | None = None
    amount: Fraction | None = None
    constraint_index: int | None = None
    reason: str | None = None


def reconstruct_expected_assignment(
    events: list[AssignmentEvent],
    n_agents: int,
    n_objects: int,
) -> list[list[Fraction]]:
    """イベントログから期待割当行列を再構成する。

    再構成ルール:
        - CONSUME: `amount` を該当セルへ加算する。
        - SUPPLY_EXHAUSTED / CONSTRAINT_SATURATED: 割当量を変化させない
          （過程の説明のためのイベント）。

    Args:
        events: 実行順のイベント列。
        n_agents: 社員数。
        n_objects: 対象（部署・案件）数。∅ 列は含めない。

    Returns:
        n_agents 行 × (n_objects + 1) 列の期待割当行列。最終列が ∅（未割当）。
    """
    matrix = [[Fraction(0) for _ in range(n_objects + 1)] for _ in range(n_agents)]
    for event in events:
        if event.event_type is not AssignmentEventType.CONSUME:
            continue
        if event.agent is None or event.obj is None or event.amount is None:
            continue
        matrix[event.agent][event.obj] += event.amount
    return matrix
