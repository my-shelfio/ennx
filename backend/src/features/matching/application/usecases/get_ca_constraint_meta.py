"""GetCaConstraintMeta ユースケース。

CA の追加制約（NG ペア等）種別ごとのパラメータスキーマを返す
（`GET /api/v1/meta/ca-constraint-types` に対応）。設定ウィザードの追加制約
フォームは、本ユースケースが返すメタ情報から動的に生成する。
"""

from __future__ import annotations

from features.matching.application.constraints import ca_constraint_metas
from features.matching.application.dto.results import CaConstraintMetaDTO


class GetCaConstraintMeta:
    """CA 制約種別のメタ情報一覧を返すユースケース。"""

    def execute(self) -> list[CaConstraintMetaDTO]:
        """登録順に全 CA 制約種別のメタ情報を返す。"""
        return ca_constraint_metas()
