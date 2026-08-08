"""マッチング API の Pydantic スキーマ。

境界変換専用のモデル。ドメインモデルを API に直接露出せず、
application 層の DTO と相互変換する。OpenAPI スキーマの源泉となり、
フロントエンドは本スキーマから型を生成する（openapi-typescript）。

入力上限: 部署 ≤ 50・社員 ≤ 100（目安値。性能計測で確定）。
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from features.matching.application.dto.requests import ConstraintEntry, MatchingRequest
from features.matching.application.dto.results import (
    CaConstraintMetaDTO,
    ConstraintTypeMetaDTO,
    MatchingOutcome,
    ValidationOutcome,
)
from shared.presentation.schemas import FieldErrorSchema, ReportItemSchema

# 入力上限（性能計測で確定するまでの目安値）。
MAX_DEPARTMENTS = 50
MAX_EMPLOYEES = 100


class ConstraintEntrySchema(BaseModel):
    """CA の追加制約 1 件（例: {"type": "ng_pair", "params": {"pairs": [[0, 1]]}}）。"""

    model_config = ConfigDict(extra="forbid")

    type: str = Field(description="制約種別キー（例: ng_pair）")
    params: dict[str, Any] = Field(
        default_factory=dict, description="制約種別ごとのパラメータ（0-indexed）"
    )


class MatchingRequestSchema(BaseModel):
    """マッチング実行・検証のリクエストボディ（run / validate 共通）。

    選好リストは 1-indexed（相手番号 1〜N）。入力途中の状態はクライアントが
    保持し、本リクエストで全量を送信する。
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
    constraints: list[ConstraintEntrySchema] | None = Field(
        default=None, description="追加制約（general）"
    )

    def to_dto(self) -> MatchingRequest:
        """application 層の入力 DTO へ変換する。"""
        return MatchingRequest(
            constraint_type=self.constraint_type,
            capacities=self.capacities,
            proposer_prefs=self.proposer_prefs,
            receiver_prefs=self.receiver_prefs,
            employee_names=self.employee_names,
            department_names=self.department_names,
            max_caps=self.max_caps,
            regions=self.regions,
            regional_caps=self.regional_caps,
            constraints=(
                [ConstraintEntry(type=c.type, params=c.params) for c in self.constraints]
                if self.constraints is not None
                else None
            ),
        )

    @classmethod
    def from_dto(cls, dto: MatchingRequest) -> MatchingRequestSchema:
        """application 層の入力 DTO から組み立てる（GET /api/v1/sample 用）。"""
        return cls(
            constraint_type=dto.constraint_type,
            capacities=dto.capacities,
            proposer_prefs=dto.proposer_prefs,
            receiver_prefs=dto.receiver_prefs,
            employee_names=dto.employee_names,
            department_names=dto.department_names,
            max_caps=dto.max_caps,
            regions=dto.regions,
            regional_caps=dto.regional_caps,
            constraints=(
                [ConstraintEntrySchema(type=c.type, params=c.params) for c in dto.constraints]
                if dto.constraints is not None
                else None
            ),
        )


class MatchingEventSchema(BaseModel):
    """イベントログ 1 件（API 契約、JSON Schema 検証済み）。"""

    round: int = Field(description="ラウンド番号（1 始まり）")
    event_type: str = Field(
        description=(
            "イベント種別（propose / tentative_accept / reject / waitlist / "
            "promote / cutoff_raise）"
        )
    )
    proposer: int | None = Field(description="対象の社員（0-indexed）。cutoff_raise のみ null")
    receiver: int = Field(description="対象の部署（0-indexed）")
    reason: str | None = Field(default=None, description="補足説明（棄却理由など）")


class MatchingRunResponse(BaseModel):
    """POST /api/v1/matching/run のレスポンス（結果 + レポート + イベントログ）。"""

    constraint_type: str = Field(description="入力の制約種別キー")
    algorithm: str = Field(description="実行された内部アルゴリズム（da / fda / ca）")
    employee_names: list[str] = Field(description="社員の表示名（自動生成含む）")
    department_names: list[str] = Field(description="部署の表示名（自動生成含む）")
    capacities: list[int] = Field(description="部署ごとの定員（FDA では目標定員）")
    proposer_match: list[int] = Field(description="社員ごとの配属先部署 0-index（-1 = 未配属）")
    receiver_match: list[list[int]] = Field(description="部署ごとの配属社員 0-index リスト")
    unmatched: list[int] = Field(description="未配属の社員 0-index リスト")
    report: list[ReportItemSchema] = Field(description="性質レポート")
    cutoff: list[int] = Field(description="最終カットオフプロファイル（CA のみ。他は空）")
    events: list[MatchingEventSchema] = Field(description="実行過程のイベントログ（実行順）")

    @classmethod
    def from_dto(cls, dto: MatchingOutcome) -> MatchingRunResponse:
        """application 層の出力 DTO から組み立てる。"""
        return cls(
            constraint_type=dto.constraint_type,
            algorithm=dto.algorithm,
            employee_names=dto.employee_names,
            department_names=dto.department_names,
            capacities=dto.capacities,
            proposer_match=dto.proposer_match,
            receiver_match=dto.receiver_match,
            unmatched=dto.unmatched,
            report=[
                ReportItemSchema(
                    label=item.label,
                    status=item.status,
                    detail=item.detail,
                    blocking_pairs=[list(pair) for pair in item.blocking_pairs],
                )
                for item in dto.report
            ],
            cutoff=dto.cutoff,
            events=[
                MatchingEventSchema(
                    round=event.round,
                    event_type=event.event_type,
                    proposer=event.proposer,
                    receiver=event.receiver,
                    reason=event.reason,
                )
                for event in dto.events
            ],
        )


class ValidateResponse(BaseModel):
    """POST /api/v1/matching/validate のレスポンス（検証結果。200 で返す）。"""

    valid: bool = Field(description="入力がそのまま実行可能なら true")
    errors: list[FieldErrorSchema] = Field(description="検証エラー（valid=true のとき空）")

    @classmethod
    def from_dto(cls, dto: ValidationOutcome) -> ValidateResponse:
        """application 層の出力 DTO から組み立てる。"""
        return cls(
            valid=dto.valid,
            errors=[FieldErrorSchema(field=e.field, message=e.message) for e in dto.errors],
        )


class AlgorithmMetaSchema(BaseModel):
    """内部アルゴリズムの表示メタ情報。"""

    key: str = Field(description="アルゴリズムキー（da / fda / ca）")
    label: str = Field(description="表示名")
    summary: str = Field(description="概要")
    properties: list[str] = Field(description="保証される理論的性質")


class ConstraintTypeMetaSchema(BaseModel):
    """制約種別のメタ情報（設定ウィザードの選択肢）。"""

    key: str = Field(description="制約種別キー")
    label: str = Field(description="表示名")
    summary: str = Field(description="利用者向けの説明")
    algorithm: AlgorithmMetaSchema = Field(description="対応する内部アルゴリズム")

    @classmethod
    def from_dto(cls, dto: ConstraintTypeMetaDTO) -> ConstraintTypeMetaSchema:
        """application 層の出力 DTO から組み立てる。"""
        return cls(
            key=dto.key,
            label=dto.label,
            summary=dto.summary,
            algorithm=AlgorithmMetaSchema(
                key=dto.algorithm.key,
                label=dto.algorithm.label,
                summary=dto.algorithm.summary,
                properties=dto.algorithm.properties,
            ),
        )


class ConstraintTypeListResponse(BaseModel):
    """GET /api/v1/meta/constraint-types のレスポンス。"""

    constraint_types: list[ConstraintTypeMetaSchema] = Field(
        description="選択可能な制約種別（登録順）"
    )


class ConstraintFieldMetaSchema(BaseModel):
    """CA 制約 1 パラメータフィールドのメタ情報（動的フォーム生成用）。"""

    name: str = Field(description="params 辞書内のキー名")
    label: str = Field(description="フォームに表示するラベル")
    field_type: str = Field(description="入力方式の種別キー（例: employee_pair_list）")
    help_text: str | None = Field(default=None, description="入力欄の補足説明")


class CaConstraintMetaSchema(BaseModel):
    """CA 制約種別（制約レジストリの登録単位）のメタ情報。"""

    key: str = Field(description="制約種別キー（ConstraintEntrySchema.type に対応）")
    label: str = Field(description="表示名")
    fields: list[ConstraintFieldMetaSchema] = Field(
        description="パラメータのフィールド定義（動的フォーム生成用、登録順）"
    )

    @classmethod
    def from_dto(cls, dto: CaConstraintMetaDTO) -> CaConstraintMetaSchema:
        """application 層の出力 DTO から組み立てる。"""
        return cls(
            key=dto.key,
            label=dto.label,
            fields=[
                ConstraintFieldMetaSchema(
                    name=f.name,
                    label=f.label,
                    field_type=f.field_type,
                    help_text=f.help_text,
                )
                for f in dto.fields
            ],
        )


class CaConstraintMetaListResponse(BaseModel):
    """GET /api/v1/meta/ca-constraint-types のレスポンス。"""

    ca_constraint_types: list[CaConstraintMetaSchema] = Field(
        description="登録済みの CA 追加制約種別（登録順）"
    )
