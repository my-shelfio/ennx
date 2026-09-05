"""RunAssignment ユースケース。

設定＋希望順位の全量を受け取り、期待割当・確定的な配属のくじ・性質レポート・
イベントログを 1 回の実行で返す（`POST /api/v1/assignment/run` に対応）。
"""

from __future__ import annotations

from features.assignment.application.assembly import (
    build_domain_input,
    build_report,
    resolve_names,
    run_mechanism,
)
from features.assignment.application.dto.requests import AssignmentRequest
from features.assignment.application.dto.results import (
    AssignmentEventDTO,
    AssignmentOutcome,
    LotteryTermDTO,
)
from features.assignment.application.meta import mechanism_for_constraint_type
from features.assignment.domain.events import AssignmentEvent
from features.assignment.domain.models import AssignmentInput, LotteryTerm


class RunAssignment:
    """割り当てを実行し、結果一式を返すユースケース。"""

    def execute(self, request: AssignmentRequest) -> AssignmentOutcome:
        """割り当てを実行する。

        Raises:
            InvalidAssignmentInputError: 入力が不正、または分解できない場合。
        """
        data = build_domain_input(request)
        result = run_mechanism(data)
        emp_names, dep_names = resolve_names(request)

        return AssignmentOutcome(
            constraint_type=request.constraint_type,
            mechanism=mechanism_for_constraint_type(request.constraint_type),
            employee_names=emp_names,
            department_names=dep_names,
            capacities=list(request.capacities),
            expected_assignment=[
                [str(value) for value in row] for row in result.expected_assignment
            ],
            lottery=[_to_term_dto(term, data) for term in result.terms],
            report=build_report(data, result),
            events=[_to_event_dto(event, data) for event in result.events],
        )


def _to_term_dto(term: LotteryTerm, data: AssignmentInput) -> LotteryTermDTO:
    """くじの 1 項を DTO へ変換する（∅ 列は -1 = 未配属として表現する）。"""
    assignment = [_external_department(term.assigned_object(i), data) for i in range(data.n_agents)]
    return LotteryTermDTO(weight=str(term.weight), assignment=assignment)


def _to_event_dto(event: AssignmentEvent, data: AssignmentInput) -> AssignmentEventDTO:
    """イベントを DTO へ変換する。"""
    department = None if event.obj is None else _external_department(event.obj, data)
    return AssignmentEventDTO(
        step=event.step,
        event_type=event.event_type.value,
        start=str(event.start),
        end=str(event.end),
        employee=event.agent,
        department=department,
        amount=None if event.amount is None else str(event.amount),
        constraint_index=event.constraint_index,
        reason=event.reason,
    )


def _external_department(column: int, data: AssignmentInput) -> int:
    """内部の列 index を API の部署 index に変換する（∅ 列は -1）。"""
    return -1 if column == data.empty_index else column
