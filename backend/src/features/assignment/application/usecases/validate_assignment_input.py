"""ValidateAssignmentInput ユースケース。

入力の事前検証のみを行う（`POST /api/v1/assignment/validate` に対応）。
設定ウィザードのステップ間検証で、実行せずに入力の妥当性を確認する。
"""

from __future__ import annotations

from features.assignment.application.assembly import build_domain_input
from features.assignment.application.dto.requests import AssignmentRequest
from features.assignment.application.dto.results import AssignmentValidationOutcome
from features.assignment.application.errors import InvalidAssignmentInputError


class ValidateAssignmentInput:
    """入力を検証し、結果をエラー一覧つきで返すユースケース。"""

    def execute(self, request: AssignmentRequest) -> AssignmentValidationOutcome:
        """入力を検証する（実行はしない）。

        検証内容は RunAssignment と同一（構造検証・ドメイン検証・分解可能性）。
        エラーは例外ではなく AssignmentValidationOutcome.errors として返す。
        """
        try:
            build_domain_input(request)
        except InvalidAssignmentInputError as exc:
            return AssignmentValidationOutcome(valid=False, errors=exc.errors)
        return AssignmentValidationOutcome(valid=True)
