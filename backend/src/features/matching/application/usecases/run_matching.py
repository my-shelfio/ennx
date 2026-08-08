"""RunMatching ユースケース。

設定＋選好の全量を受け取り、配属結果・性質レポート・イベントログ・カットオフを
1 回の実行で返す（`POST /api/v1/matching/run` に対応）。
"""

from __future__ import annotations

from features.matching.application.assembly import (
    build_domain_input,
    build_report,
    execute_algorithm,
    resolve_names,
)
from features.matching.application.dto.requests import MatchingRequest
from features.matching.application.dto.results import MatchingEventDTO, MatchingOutcome
from features.matching.application.meta import algorithm_for_constraint_type
from features.matching.domain.models import CAResult


class RunMatching:
    """マッチングを実行し、結果一式を返すユースケース。"""

    def execute(self, request: MatchingRequest) -> MatchingOutcome:
        """マッチングを実行する。

        Raises:
            InvalidMatchingInputError: 入力が不正な場合。
        """
        matching_input = build_domain_input(request)
        algorithm = algorithm_for_constraint_type(request.constraint_type)
        result = execute_algorithm(algorithm, matching_input)
        emp_names, dep_names = resolve_names(request)

        unmatched = [i for i, dep in enumerate(result.proposer_match) if dep == -1]
        events = [
            MatchingEventDTO(
                round=event.round,
                event_type=event.event_type.value,
                proposer=event.proposer,
                receiver=event.receiver,
                reason=event.reason,
            )
            for event in result.events
        ]
        cutoff = list(result.cutoff_profile) if isinstance(result, CAResult) else []

        return MatchingOutcome(
            constraint_type=request.constraint_type,
            algorithm=algorithm,
            employee_names=emp_names,
            department_names=dep_names,
            capacities=request.capacities,
            proposer_match=list(result.proposer_match),
            receiver_match=[list(matched) for matched in result.receiver_match],
            unmatched=unmatched,
            report=build_report(algorithm, request, result),
            cutoff=cutoff,
            events=events,
        )
