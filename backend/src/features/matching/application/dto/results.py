"""ユースケース出力 DTO。

presentation 層はこれらの DTO を Pydantic レスポンスモデルへ変換する。
ドメインモデル（MatchingResult / MatchingEvent）を API に直接露出しないための
境界データ。
"""

from __future__ import annotations

from dataclasses import dataclass, field

from shared.application.errors import FieldError
from shared.domain.report import ReportItem


@dataclass(frozen=True, kw_only=True)
class MatchingEventDTO:
    """イベントログ 1 件。

    Attributes:
        round: ラウンド番号（1 始まり）。
        event_type: イベント種別の文字列値（propose / tentative_accept / reject /
            waitlist / promote / cutoff_raise）。
        proposer: 対象の社員（0-indexed）。cutoff_raise のみ None。
        receiver: 対象の部署（0-indexed）。
        reason: 補足説明（棄却理由など）。省略可。
    """

    round: int
    event_type: str
    proposer: int | None
    receiver: int
    reason: str | None = None


@dataclass(frozen=True, kw_only=True)
class MatchingOutcome:
    """RunMatching の出力（配属・性質レポート・イベントログ・カットオフ）。

    Attributes:
        constraint_type: 入力の制約種別キー。
        algorithm: ディスパッチされた内部アルゴリズムキー（da / fda / ca）。
        employee_names: 社員の表示名（省略入力時は自動生成済み）。
        department_names: 部署の表示名（省略入力時は自動生成済み）。
        capacities: 部署の定員（FDA では目標定員）。
        proposer_match: proposer_match[i] = 配属先部署の 0-index（-1 = 未配属）。
        receiver_match: receiver_match[j] = 配属された社員の 0-index リスト。
        unmatched: 未配属の社員の 0-index リスト。
        report: 性質レポート（アルゴリズムに応じた項目列）。
        cutoff: 最終カットオフプロファイル（CA のみ。他は空リスト）。
        events: 実行過程のイベントログ（実行順）。
    """

    constraint_type: str
    algorithm: str
    employee_names: list[str]
    department_names: list[str]
    capacities: list[int]
    proposer_match: list[int]
    receiver_match: list[list[int]]
    unmatched: list[int]
    report: list[ReportItem]
    cutoff: list[int] = field(default_factory=list)
    events: list[MatchingEventDTO] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class ValidationOutcome:
    """ValidateInput の出力。

    Attributes:
        valid: 入力がそのまま実行可能なら True。
        errors: 検証エラー（valid=True のとき空リスト）。
    """

    valid: bool
    errors: list[FieldError] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class AlgorithmMetaDTO:
    """内部アルゴリズムの表示メタ情報（結果画面のツールチップ等で使用）。"""

    key: str
    label: str
    summary: str
    properties: list[str]


@dataclass(frozen=True, kw_only=True)
class ConstraintTypeMetaDTO:
    """制約種別のメタ情報（設定ウィザードの選択肢）。

    Attributes:
        key: 制約種別キー（capacity_only / regional_cap / general）。
        label: 表示名。
        summary: 利用者向けの説明。
        algorithm: 対応する内部アルゴリズムのメタ情報。
    """

    key: str
    label: str
    summary: str
    algorithm: AlgorithmMetaDTO


@dataclass(frozen=True, kw_only=True)
class ConstraintFieldMetaDTO:
    """CA 制約 1 パラメータフィールドのメタ情報（動的フォーム生成用）。

    Attributes:
        name: params 辞書内のキー名。
        label: フォームに表示するラベル。
        field_type: フィールドの入力方式を表す種別キー（例: employee_pair_list）。
        help_text: 入力欄の補足説明（任意）。
    """

    name: str
    label: str
    field_type: str
    help_text: str | None = None


@dataclass(frozen=True, kw_only=True)
class CaConstraintMetaDTO:
    """CA 制約種別（制約レジストリの登録単位）のメタ情報。

    Attributes:
        key: 制約種別キー（`ConstraintEntry.type` に対応。例: "ng_pair"）。
        label: 表示名。
        fields: パラメータのフィールド定義（動的フォーム生成用、登録順）。
    """

    key: str
    label: str
    fields: list[ConstraintFieldMetaDTO]
