"""GetConstraintMeta ユースケース。

制約種別・アルゴリズムのメタ情報を返す（`GET /api/v1/meta/constraint-types` に対応）。
設定ウィザードの制約種別カードの選択肢として利用する。
"""

from __future__ import annotations

from features.matching.application.dto.results import ConstraintTypeMetaDTO
from features.matching.application.meta import constraint_type_metas


class GetConstraintMeta:
    """制約種別のメタ情報一覧を返すユースケース。"""

    def execute(self) -> list[ConstraintTypeMetaDTO]:
        """全制約種別のメタ情報を登録順に返す。"""
        return constraint_type_metas()
