"""割り当て API の Pydantic スキーマ。

境界変換専用のモデル。ドメインモデルを API に直接露出せず、application 層の
DTO と相互変換する。OpenAPI スキーマの源泉となり、フロントエンドは本スキーマ
から型を生成する（openapi-typescript）。

分数は情報を落とさないよう "1/2" 形式の既約文字列で返す。丸めは表示側の責務。

入力上限: 部署 ≤ 50・社員 ≤ 100（domain 層の上限と揃える）。
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from features.assignment.application.dto.requests import AssignmentRequest, ConstraintEntry
from features.assignment.application.dto.results import (
    AssignmentConstraintTypeMetaDTO,
    AssignmentOutcome,
    AssignmentValidationOutcome,
    MechanismMetaDTO,
    UpperConstraintMetaDTO,
)
from shared.presentation.schemas import FieldErrorSchema, ReportItemSchema

MAX_DEPARTMENTS = 50
MAX_EMPLOYEES = 100


class AssignmentConstraintEntrySchema(BaseModel):
    """追加の上限制約 1 件（例: {"type": "ng_pair", "params": {"pairs": [[0, 1]]}}）。"""

    model_config = ConfigDict(extra="forbid")

    type: str = Field(description="制約種別キー（ng_pair / group_quota）")
    params: dict[str, Any] = Field(
        default_factory=dict, description="制約種別ごとのパラメータ（0-indexed）"
    )


class AssignmentRequestSchema(BaseModel):
    """割り当て実行・検証のリクエストボディ（run / validate 共通）。

    希望順位リストは 1-indexed（部署番号 1〜M）。部署の側は候補者を順位づけ
    しないため、部署ごとの優先順位リストは受け取らない。
    """

    model_config = ConfigDict(extra="forbid")

    constraint_type: str = Field(description="制約種別キー（capacity_only / general）")
    capacities: list[int] = Field(
        min_length=1, max_length=MAX_DEPARTMENTS, description="部署ごとの受け入れ人数"
    )
    agent_prefs: list[list[int]] = Field(
        min_length=1,
        max_length=MAX_EMPLOYEES,
        description="社員ごとの希望順位リスト（1-indexed の部署番号）",
    )
    employee_names: list[str] | None = Field(
        default=None, max_length=MAX_EMPLOYEES, description="社員の表示名（省略時は自動生成）"
    )
    department_names: list[str] | None = Field(
        default=None, max_length=MAX_DEPARTMENTS, description="部署の表示名（省略時は自動生成）"
    )
    constraints: list[AssignmentConstraintEntrySchema] | None = Field(
        default=None, description="追加の上限制約（general のみ指定可）"
    )

    def to_dto(self) -> AssignmentRequest:
        """application 層の入力 DTO へ変換する。"""
        return AssignmentRequest(
            constraint_type=self.constraint_type,
            capacities=self.capacities,
            agent_prefs=self.agent_prefs,
            employee_names=self.employee_names,
            department_names=self.department_names,
            constraints=(
                [ConstraintEntry(type=c.type, params=c.params) for c in self.constraints]
                if self.constraints is not None
                else None
            ),
        )

    @classmethod
    def from_dto(cls, dto: AssignmentRequest) -> AssignmentRequestSchema:
        """application 層の入力 DTO から組み立てる（サンプル取得用）。"""
        return cls(
            constraint_type=dto.constraint_type,
            capacities=dto.capacities,
            agent_prefs=dto.agent_prefs,
            employee_names=dto.employee_names,
            department_names=dto.department_names,
            constraints=(
                [
                    AssignmentConstraintEntrySchema(type=c.type, params=c.params)
                    for c in dto.constraints
                ]
                if dto.constraints is not None
                else None
            ),
        )


class AssignmentEventSchema(BaseModel):
    """イーティング過程のイベント 1 件。"""

    step: int = Field(description="区間番号（1 始まり）")
    event_type: str = Field(
        description="イベント種別（consume / supply_exhausted / constraint_saturated）"
    )
    start: str = Field(description="区間の開始時刻（分数の文字列。例: 1/2）")
    end: str = Field(description="区間の終了時刻（分数の文字列）")
    employee: int | None = Field(default=None, description="対象の社員 0-index（consume のみ）")
    department: int | None = Field(
        default=None, description="対象の部署 0-index（-1 = 未配属。制約の飽和では null）"
    )
    amount: str | None = Field(default=None, description="区間で消費した量（分数の文字列）")
    constraint_index: int | None = Field(default=None, description="飽和した上限制約の 0-index")
    reason: str | None = Field(default=None, description="補足説明")


class LotteryTermSchema(BaseModel):
    """くじの 1 項（重みと確定的な配属）。"""

    weight: str = Field(description="この配属を引く確率（分数の文字列）")
    assignment: list[int] = Field(
        description="assignment[i] = 社員 i の配属先部署 0-index（-1 = 未配属）"
    )


class AssignmentRunResponse(BaseModel):
    """割り当て実行のレスポンス。"""

    constraint_type: str = Field(description="入力の制約種別キー")
    mechanism: str = Field(description="実行したメカニズムキー（ps）")
    employee_names: list[str] = Field(description="社員の表示名")
    department_names: list[str] = Field(description="部署の表示名")
    capacities: list[int] = Field(description="部署ごとの受け入れ人数")
    expected_assignment: list[list[str]] = Field(
        description=(
            "期待割当行列（分数の文字列）。行が社員、列が部署で、"
            "最終列（index = 部署数）は未配属を表す。"
        )
    )
    lottery: list[LotteryTermSchema] = Field(description="確定的な配属のくじ（重みの降順）")
    report: list[ReportItemSchema] = Field(description="性質レポート")
    events: list[AssignmentEventSchema] = Field(description="イーティング過程のイベントログ")

    @classmethod
    def from_dto(cls, dto: AssignmentOutcome) -> AssignmentRunResponse:
        """application 層の出力 DTO から組み立てる。"""
        return cls(
            constraint_type=dto.constraint_type,
            mechanism=dto.mechanism,
            employee_names=dto.employee_names,
            department_names=dto.department_names,
            capacities=dto.capacities,
            expected_assignment=dto.expected_assignment,
            lottery=[
                LotteryTermSchema(weight=term.weight, assignment=term.assignment)
                for term in dto.lottery
            ],
            report=[
                ReportItemSchema(
                    label=item.label,
                    status=item.status,
                    detail=item.detail,
                    blocking_pairs=[list(pair) for pair in item.blocking_pairs],
                )
                for item in dto.report
            ],
            events=[
                AssignmentEventSchema(
                    step=event.step,
                    event_type=event.event_type,
                    start=event.start,
                    end=event.end,
                    employee=event.employee,
                    department=event.department,
                    amount=event.amount,
                    constraint_index=event.constraint_index,
                    reason=event.reason,
                )
                for event in dto.events
            ],
        )


class AssignmentValidateResponse(BaseModel):
    """入力検証のレスポンス。"""

    valid: bool = Field(description="入力がそのまま実行可能なら true")
    errors: list[FieldErrorSchema] = Field(default_factory=list, description="検証エラー")

    @classmethod
    def from_dto(cls, dto: AssignmentValidationOutcome) -> AssignmentValidateResponse:
        """application 層の出力 DTO から組み立てる。"""
        return cls(
            valid=dto.valid,
            errors=[FieldErrorSchema(field=e.field, message=e.message) for e in dto.errors],
        )


class MechanismMetaSchema(BaseModel):
    """メカニズムの表示メタ情報。"""

    key: str = Field(description="メカニズムキー（ps）")
    label: str = Field(description="表示名")
    summary: str = Field(description="利用者向けの説明")
    guaranteed: list[str] = Field(description="保証する性質")
    not_guaranteed: list[str] = Field(description="保証しない性質")

    @classmethod
    def from_dto(cls, dto: MechanismMetaDTO) -> MechanismMetaSchema:
        """application 層の DTO から組み立てる。"""
        return cls(
            key=dto.key,
            label=dto.label,
            summary=dto.summary,
            guaranteed=dto.guaranteed,
            not_guaranteed=dto.not_guaranteed,
        )


class AssignmentConstraintTypeMetaSchema(BaseModel):
    """制約種別のメタ情報。"""

    key: str = Field(description="制約種別キー")
    label: str = Field(description="表示名")
    summary: str = Field(description="利用者向けの説明")
    mechanism: MechanismMetaSchema = Field(description="対応するメカニズムのメタ情報")

    @classmethod
    def from_dto(cls, dto: AssignmentConstraintTypeMetaDTO) -> AssignmentConstraintTypeMetaSchema:
        """application 層の DTO から組み立てる。"""
        return cls(
            key=dto.key,
            label=dto.label,
            summary=dto.summary,
            mechanism=MechanismMetaSchema.from_dto(dto.mechanism),
        )


class AssignmentConstraintTypeListResponse(BaseModel):
    """制約種別一覧のレスポンス。"""

    constraint_types: list[AssignmentConstraintTypeMetaSchema] = Field(description="制約種別の一覧")


class ConstraintFieldMetaSchema(BaseModel):
    """追加制約 1 パラメータフィールドのメタ情報。"""

    name: str = Field(description="params 辞書内のキー名")
    label: str = Field(description="フォームに表示するラベル")
    field_type: str = Field(description="入力方式を表す種別キー")
    help_text: str | None = Field(default=None, description="入力欄の補足説明")


class UpperConstraintMetaSchema(BaseModel):
    """追加の上限制約種別のメタ情報。"""

    key: str = Field(description="制約種別キー")
    label: str = Field(description="表示名")
    fields: list[ConstraintFieldMetaSchema] = Field(description="パラメータのフィールド定義")

    @classmethod
    def from_dto(cls, dto: UpperConstraintMetaDTO) -> UpperConstraintMetaSchema:
        """application 層の DTO から組み立てる。"""
        return cls(
            key=dto.key,
            label=dto.label,
            fields=[
                ConstraintFieldMetaSchema(
                    name=f.name, label=f.label, field_type=f.field_type, help_text=f.help_text
                )
                for f in dto.fields
            ],
        )


class UpperConstraintMetaListResponse(BaseModel):
    """追加制約種別一覧のレスポンス。"""

    upper_constraint_types: list[UpperConstraintMetaSchema] = Field(
        description="追加の上限制約種別の一覧"
    )
