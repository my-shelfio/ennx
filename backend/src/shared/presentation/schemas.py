"""feature 横断の Pydantic スキーマ（境界変換専用）。

FieldErrorSchema（入力エラー 1 件）・ReportItemSchema（性質レポート 1 項目）は
各 feature のレスポンススキーマ・エラーハンドラが共通で使う。
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from shared.application.errors import FieldError
from shared.domain.report import ReportItem


class FieldErrorSchema(BaseModel):
    """入力エラー 1 件（フィールド単位でフォームにマッピング可能）。"""

    field: str | None = Field(description="エラーの発生フィールド（特定できない場合は null）")
    message: str = Field(description="利用者向けの日本語エラーメッセージ")

    @classmethod
    def from_domain(cls, error: FieldError) -> FieldErrorSchema:
        """application 層の FieldError から組み立てる。"""
        return cls(field=error.field, message=error.message)


class ReportItemSchema(BaseModel):
    """性質レポートの 1 項目。"""

    label: str = Field(description="性質名（例: 安定性）")
    status: str = Field(description="判定（ok / ng / info）")
    detail: str = Field(description="判定の説明")
    blocking_pairs: list[list[int]] = Field(
        default_factory=list,
        description=(
            "安定性・弱安定性違反の原因となったブロッキングペアの一覧。"
            "各要素は [社員 0-index, 部署 0-index]。該当しない性質・違反なしの場合は空配列。"
        ),
    )

    @classmethod
    def from_domain(cls, item: ReportItem) -> ReportItemSchema:
        """ドメインの ReportItem から組み立てる。"""
        return cls(
            label=item.label,
            status=item.status,
            detail=item.detail,
            blocking_pairs=[list(pair) for pair in item.blocking_pairs],
        )
