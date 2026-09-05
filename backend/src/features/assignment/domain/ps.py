"""PS（Probabilistic Serial / 同時確率消費）メカニズム。

対応する割り当て問題:
  - 片側選好の多対 1 割り当て（席替え・持ち回り・機会配分・案件アサインなど）
  - 各対象は供給数（capacities）まで複数の社員を受け入れられる
  - 追加の上限制約（NG ペア分離・グループ別クォータ等）に対応する（拡張 PS）

理論:
  全社員が時刻 0 から速度 1 で「いま獲得可能な最も好きな対象」を同時に食べ、
  時刻 1 で食べ終える。獲得可能とは「供給に空きがあり、かつ (社員, 対象) に
  関わるすべての上限制約にまだ余地がある」こと。時刻 1 までに各社員が各対象を
  食べた量が、その社員がその対象を受け取る期待個数（期待割当）になる。

  上限制約が無い場合は素の PS と一致する（Bogomolnaia and Moulin, 2001）。
  上限制約付きの拡張は、獲得可能性の定義に制約の余地を加えたものである。

保証する性質: 順序効率性・無羨望性・水平性（検証は checks モジュール）。
保証しない性質: 耐戦略性（虚偽申告で得できるケースが存在する）。

得られる期待割当は分数行列であり、そのままでは配れない。実際に配るための
純割当のくじへの分解は lottery モジュール（一般化 BvN 分解）が担う。
"""

from __future__ import annotations

from fractions import Fraction

from .events import AssignmentEvent, AssignmentEventType
from .models import AssignmentInput, AssignmentResult


def probabilistic_serial(data: AssignmentInput) -> AssignmentResult:
    """PS メカニズムを実行し、期待割当行列を返す。

    入力の希望順位リストは 1-indexed、返り値の行列は 0-indexed
    （models モジュールの docstring を参照）。

    Args:
        data: 希望順位・供給数・上限制約。

    Returns:
        期待割当行列とイーティング過程のイベントログ。
    """
    n_agents = data.n_agents
    n_cols = data.n_objects + 1
    empty = data.empty_index

    # 残供給量（∅ は無制限なので None で表す）
    remaining: list[Fraction | None] = [Fraction(cap) for cap in data.capacities]
    remaining.append(None)

    matrix = [[Fraction(0) for _ in range(n_cols)] for _ in range(n_agents)]
    events: list[AssignmentEvent] = []

    time = Fraction(0)
    end = Fraction(1)
    step = 0
    while time < end:
        step += 1
        eating = [_pick(data, agent, matrix, remaining) for agent in range(n_agents)]

        delta = _next_event_time(data, eating, matrix, remaining, end - time)
        stop = time + delta

        for agent, obj in enumerate(eating):
            matrix[agent][obj] += delta
            events.append(
                AssignmentEvent(
                    step=step,
                    event_type=AssignmentEventType.CONSUME,
                    start=time,
                    end=stop,
                    agent=agent,
                    obj=obj,
                    amount=delta,
                    reason=None if obj != empty else "獲得可能な希望対象が残っていない",
                )
            )

        for obj in range(data.n_objects):
            amount = remaining[obj]
            if amount is None:
                continue
            eaters = eating.count(obj)
            if eaters == 0:
                continue
            remaining[obj] = amount - eaters * delta
            if remaining[obj] == 0:
                events.append(
                    AssignmentEvent(
                        step=step,
                        event_type=AssignmentEventType.SUPPLY_EXHAUSTED,
                        start=time,
                        end=stop,
                        obj=obj,
                        reason=f"{data.o_name(obj)} の供給数が尽きた",
                    )
                )

        for index, constraint in enumerate(data.constraints):
            rate = sum(1 for agent, obj in enumerate(eating) if (agent, obj) in constraint.cells)
            if rate == 0:
                continue
            if _constraint_total(constraint.cells, matrix) >= constraint.upper:
                events.append(
                    AssignmentEvent(
                        step=step,
                        event_type=AssignmentEventType.CONSTRAINT_SATURATED,
                        start=time,
                        end=stop,
                        constraint_index=index,
                        reason=f"{constraint.display_label()} が上限に達した",
                    )
                )

        time = stop

    return AssignmentResult(expected_assignment=matrix, events=events)


def _pick(
    data: AssignmentInput,
    agent: int,
    matrix: list[list[Fraction]],
    remaining: list[Fraction | None],
) -> int:
    """社員 agent がいま食べる対象の 0-index を返す（獲得可能でなければ ∅）。"""
    for obj in data.acceptable(agent):
        if obj == data.empty_index:
            break
        amount = remaining[obj]
        if amount is not None and amount > 0 and _within_constraints(data, agent, obj, matrix):
            return obj
    return data.empty_index


def _within_constraints(
    data: AssignmentInput,
    agent: int,
    obj: int,
    matrix: list[list[Fraction]],
) -> bool:
    """(agent, obj) に関わるすべての上限制約にまだ余地があるか。"""
    for constraint in data.constraints:
        if (agent, obj) not in constraint.cells:
            continue
        if _constraint_total(constraint.cells, matrix) >= constraint.upper:
            return False
    return True


def _next_event_time(
    data: AssignmentInput,
    eating: list[int],
    matrix: list[list[Fraction]],
    remaining: list[Fraction | None],
    limit: Fraction,
) -> Fraction:
    """次に供給が尽きるか上限制約が飽和するまでの経過時間を返す（上限は limit）。"""
    delta = limit
    for obj in set(eating):
        amount = remaining[obj]
        if amount is None:
            continue  # ∅ は無制限なので時間を区切らない
        delta = min(delta, amount / eating.count(obj))
    for constraint in data.constraints:
        rate = sum(1 for agent, obj in enumerate(eating) if (agent, obj) in constraint.cells)
        if rate == 0:
            continue
        current = _constraint_total(constraint.cells, matrix)
        delta = min(delta, (Fraction(constraint.upper) - current) / rate)
    return delta


def _constraint_total(cells: frozenset[tuple[int, int]], matrix: list[list[Fraction]]) -> Fraction:
    """制約対象セルの現在の合計値を返す。"""
    return sum((matrix[i][j] for (i, j) in cells), Fraction(0))
