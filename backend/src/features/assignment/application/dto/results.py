"""assignment ユースケースの出力 DTO。

presentation 層はこれらの DTO を Pydantic レスポンスモデルへ変換する。
分数は情報を落とさないよう `Fraction` の既約表現（"1/2" 形式の文字列）で運ぶ。
小数に丸めるのは表示側の責務とする。
"""

from __future__ import annotations

from dataclasses import dataclass, field

from shared.application.errors import FieldError
from shared.domain.report import ReportItem


@dataclass(frozen=True, kw_only=True)
class AssignmentEventDTO:
    """イーティング過程のイベント 1 件。

    Attributes:
        step: 区間番号（1 始まり）。
        event_type: イベント種別（consume / supply_exhausted / constraint_saturated）。
        start: 区間の開始時刻（分数の文字列表現）。
        end: 区間の終了時刻（分数の文字列表現）。
        employee: 対象の社員（0-indexed）。consume 以外では None。
        department: 対象の部署（0-indexed）。未割当（∅）は -1。
            constraint_saturated では None。
        amount: 区間で消費した量（分数の文字列表現）。consume 以外では None。
        constraint_index: 飽和した上限制約の 0-index。
            constraint_saturated 以外では None。
        reason: 補足説明。
    """

    step: int
    event_type: str
    start: str
    end: str
    employee: int | None = None
    department: int | None = None
    amount: str | None = None
    constraint_index: int | None = None
    reason: str | None = None


@dataclass(frozen=True, kw_only=True)
class LotteryTermDTO:
    """くじの 1 項（重みと確定的な配属）。

    Attributes:
        weight: この配属を引く確率（分数の文字列表現）。
        assignment: assignment[i] = 社員 i の配属先部署の 0-index（-1 = 未配属）。
    """

    weight: str
    assignment: list[int]


@dataclass(frozen=True, kw_only=True)
class AssignmentOutcome:
    """RunAssignment の出力。

    Attributes:
        constraint_type: 入力の制約種別キー。
        mechanism: ディスパッチされたメカニズムキー（ps）。
        employee_names: 社員の表示名（省略入力時は自動生成済み）。
        department_names: 部署の表示名（省略入力時は自動生成済み）。
        capacities: 部署の受け入れ人数。
        expected_assignment: 期待割当行列。行が社員、列が部署で、
            最終列（index = 部署数）は未配属（∅）を表す。各成分は分数の文字列。
        lottery: 確定的な配属のくじの全項（重みの降順）。全項を列挙できなかった
            場合は空リストになる（lottery_complete=False）。
        lottery_complete: lottery がくじの全項かどうか。
        drawn_assignment: 抽選 1 回分の配属。drawn_assignment[i] = 社員 i の
            配属先部署の 0-index（-1 = 未配属）。
        seed: 抽選に使った乱数シード。同じ入力・同じシードで再現できる。
        report: 性質レポート。
        events: イーティング過程のイベントログ。
    """

    constraint_type: str
    mechanism: str
    employee_names: list[str]
    department_names: list[str]
    capacities: list[int]
    expected_assignment: list[list[str]]
    lottery: list[LotteryTermDTO]
    lottery_complete: bool
    drawn_assignment: list[int]
    seed: int
    report: list[ReportItem]
    events: list[AssignmentEventDTO] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class AssignmentValidationOutcome:
    """ValidateAssignmentInput の出力。

    Attributes:
        valid: 入力がそのまま実行可能なら True。
        errors: 検証エラー（valid=True のとき空リスト）。
    """

    valid: bool
    errors: list[FieldError] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class MechanismMetaDTO:
    """メカニズムの表示メタ情報（結果画面の説明で使用）。"""

    key: str
    label: str
    summary: str
    guaranteed: list[str]
    not_guaranteed: list[str]


@dataclass(frozen=True, kw_only=True)
class AssignmentConstraintTypeMetaDTO:
    """制約種別のメタ情報（設定ウィザードの選択肢）。"""

    key: str
    label: str
    summary: str
    mechanism: MechanismMetaDTO


@dataclass(frozen=True, kw_only=True)
class ConstraintFieldMetaDTO:
    """追加制約 1 パラメータフィールドのメタ情報（動的フォーム生成用）。"""

    name: str
    label: str
    field_type: str
    help_text: str | None = None


@dataclass(frozen=True, kw_only=True)
class UpperConstraintMetaDTO:
    """追加の上限制約種別のメタ情報。"""

    key: str
    label: str
    fields: list[ConstraintFieldMetaDTO]
