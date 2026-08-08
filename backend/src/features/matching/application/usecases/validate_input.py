"""ValidateInput ユースケース。

入力の事前検証のみを行う（`POST /api/v1/matching/validate` に対応）。
設定ウィザードのステップ間検証で、実行せずに入力の妥当性を確認する。
"""

from __future__ import annotations

from features.matching.application.assembly import build_domain_input
from features.matching.application.dto.requests import MatchingRequest
from features.matching.application.dto.results import ValidationOutcome
from features.matching.application.errors import InvalidMatchingInputError


class ValidateInput:
    """入力を検証し、結果をエラー一覧つきで返すユースケース。"""

    def execute(self, request: MatchingRequest) -> ValidationOutcome:
        """入力を検証する（実行はしない）。

        検証内容は RunMatching と同一（構造検証 + ドメインモデルの構築検証）。
        エラーは例外ではなく ValidationOutcome.errors として返す。
        """
        try:
            build_domain_input(request)
        except InvalidMatchingInputError as exc:
            return ValidationOutcome(valid=False, errors=exc.errors)
        return ValidationOutcome(valid=True)
