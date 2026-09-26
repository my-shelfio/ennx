"""GetAssignmentConstraintMeta / GetUpperConstraintMeta ユースケース。

設定ウィザードが参照する制約種別・追加制約のメタ情報を返す
（`GET /api/v1/meta/assignment-constraint-types` /
`GET /api/v1/meta/assignment-upper-constraint-types` に対応）。
"""

from __future__ import annotations

from features.assignment.application.constraints import upper_constraint_metas
from features.assignment.application.dto.results import (
    AssignmentConstraintTypeMetaDTO,
    UpperConstraintMetaDTO,
)
from features.assignment.application.meta import constraint_type_metas


class GetAssignmentConstraintMeta:
    """制約種別のメタ情報を返すユースケース。"""

    def execute(self) -> list[AssignmentConstraintTypeMetaDTO]:
        """制約種別の一覧を登録順に返す。"""
        return constraint_type_metas()


class GetUpperConstraintMeta:
    """追加の上限制約種別のメタ情報を返すユースケース。"""

    def execute(self) -> list[UpperConstraintMetaDTO]:
        """追加制約の種別一覧を登録順に返す。"""
        return upper_constraint_metas()
