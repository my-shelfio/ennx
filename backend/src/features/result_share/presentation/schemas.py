"""結果共有 API の Pydantic スキーマ（境界変換専用）。

共有するマッチング入力（SharedMatchingInputSchema）は、マッチング実行 API の
リクエストボディと同じ形式・件数上限で検証する。閲覧画面は取得した入力を
そのままマッチング実行 API に送って結果を再計算する。feature 間の独立性を
保つためマッチング機能のスキーマは import せず、同じ形を本モジュールで定義する
（両者の一致はテストで保証する）。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from features.result_share.application.dto import (
    CreateResultShareRequest,
    ResultShareCreated,
    SharedResultView,
)
from features.result_share.application.errors import SharedResultIncompatibleError
from features.result_share.domain import (
    DEFAULT_RETENTION_DAYS,
    MAX_RETENTION_DAYS,
    MIN_RETENTION_DAYS,
)

# マッチング実行 API と同じ入力上限。
MAX_DEPARTMENTS = 50
MAX_EMPLOYEES = 100


class SharedConstraintEntrySchema(BaseModel):
    """CA の追加制約 1 件（例: {"type": "ng_pair", "params": {"pairs": [[0, 1]]}}）。"""

    model_config = ConfigDict(extra="forbid")

    type: str = Field(description="制約種別キー（例: ng_pair）")
    params: dict[str, Any] = Field(
        default_factory=dict, description="制約種別ごとのパラメータ（0-indexed）"
    )


class SharedMatchingInputSchema(BaseModel):
    """共有するマッチングの入力（マッチング実行 API のリクエストボディと同じ形式）。

    選好リストは 1-indexed（相手番号 1〜N）。
    """

    model_config = ConfigDict(extra="forbid")

    constraint_type: str = Field(
        description="制約種別キー（capacity_only / regional_cap / general）"
    )
    capacities: list[int] = Field(
        min_length=1, max_length=MAX_DEPARTMENTS, description="部署ごとの定員"
    )
    proposer_prefs: list[list[int]] = Field(
        min_length=1,
        max_length=MAX_EMPLOYEES,
        description="社員ごとの希望順位リスト（1-indexed の部署番号）",
    )
    receiver_prefs: list[list[int]] = Field(
        min_length=1,
        max_length=MAX_DEPARTMENTS,
        description="部署ごとの優先順位リスト（1-indexed の社員番号）",
    )
    employee_names: list[str] | None = Field(
        default=None, max_length=MAX_EMPLOYEES, description="社員の表示名（省略時は自動生成）"
    )
    department_names: list[str] | None = Field(
        default=None, max_length=MAX_DEPARTMENTS, description="部署の表示名（省略時は自動生成）"
    )
    max_caps: list[int] | None = Field(
        default=None, max_length=MAX_DEPARTMENTS, description="部署ごとの設置上限（regional_cap）"
    )
    regions: list[int] | None = Field(
        default=None,
        max_length=MAX_DEPARTMENTS,
        description="部署ごとの地域番号 0-indexed（regional_cap）",
    )
    regional_caps: list[int] | None = Field(
        default=None,
        max_length=MAX_DEPARTMENTS,
        description="地域ごとの受け入れ上限（regional_cap）",
    )
    constraints: list[SharedConstraintEntrySchema] | None = Field(
        default=None, description="追加制約（general）"
    )


class ResultShareCreateSchema(BaseModel):
    """閲覧用 URL 発行のリクエストボディ。"""

    model_config = ConfigDict(extra="forbid")

    input: SharedMatchingInputSchema = Field(description="共有するマッチングの入力")
    retention_days: int = Field(
        default=DEFAULT_RETENTION_DAYS,
        description=(
            f"保持期間（日数。{MIN_RETENTION_DAYS}〜{MAX_RETENTION_DAYS}、"
            f"既定 {DEFAULT_RETENTION_DAYS}）。期限後に自動削除する"
        ),
    )

    def to_dto(self) -> CreateResultShareRequest:
        """application 層の DTO へ変換する。"""
        return CreateResultShareRequest(
            snapshot=self.input.model_dump(mode="json"),
            retention_days=self.retention_days,
        )


class ResultShareCreatedSchema(BaseModel):
    """閲覧用 URL 発行のレスポンス（トークンはこの応答でのみ返す）。"""

    view_token: str = Field(description="閲覧用 URL トークン")
    delete_token: str = Field(description="削除用トークン（発行者のブラウザで保持する）")
    created_at: datetime = Field(description="発行日時（UTC）")
    expires_at: datetime = Field(description="自動削除日時（UTC）")

    @classmethod
    def from_dto(cls, dto: ResultShareCreated) -> ResultShareCreatedSchema:
        """application 層の DTO から組み立てる。"""
        return cls(
            view_token=dto.view_token,
            delete_token=dto.delete_token,
            created_at=dto.created_at,
            expires_at=dto.expires_at,
        )


class SharedResultSchema(BaseModel):
    """閲覧用トークンで取得する共有データ（結果は含まず、閲覧時に再計算する）。"""

    input: SharedMatchingInputSchema = Field(
        description="共有されたマッチングの入力（マッチング実行 API にそのまま送信できる）"
    )
    created_at: datetime = Field(description="発行日時（UTC）")
    expires_at: datetime = Field(description="自動削除日時（UTC）")

    @classmethod
    def from_dto(cls, dto: SharedResultView) -> SharedResultSchema:
        """application 層の DTO から組み立てる。

        保存済みの入力は発行時に検証済みだが、保持期間中に入力形式が変わると
        現在の形式に合わなくなるため、その場合は表示できない旨のエラーにする。
        """
        try:
            shared_input = SharedMatchingInputSchema.model_validate(dto.snapshot)
        except ValidationError as exc:
            raise SharedResultIncompatibleError(
                "この共有データは、発行後のアプリの更新により表示できなくなりました"
            ) from exc
        return cls(input=shared_input, created_at=dto.created_at, expires_at=dto.expires_at)


class ResultShareCleanupResponseSchema(BaseModel):
    """期限切れ削除のレスポンス。"""

    deleted: int = Field(description="削除した共有データの件数")
