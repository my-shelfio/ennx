"""共通スキーマ（FieldErrorSchema・ReportItemSchema）の変換ヘルパーのテスト。"""

from __future__ import annotations

from shared.application.errors import FieldError
from shared.domain.report import ReportItem
from shared.presentation.schemas import FieldErrorSchema, ReportItemSchema


def test_field_error_schema_from_domain() -> None:
    schema = FieldErrorSchema.from_domain(
        FieldError(field="options", message="選択肢が重複しています")
    )

    assert schema.field == "options"
    assert schema.message == "選択肢が重複しています"


def test_field_error_schema_from_domain_keeps_null_field() -> None:
    schema = FieldErrorSchema.from_domain(FieldError(field=None, message="入力が不正です"))

    assert schema.field is None


def test_report_item_schema_from_domain_converts_blocking_pairs_to_lists() -> None:
    item = ReportItem(label="安定性", status="ng", detail="違反", blocking_pairs=[(0, 1), (2, 0)])

    schema = ReportItemSchema.from_domain(item)

    assert schema.label == "安定性"
    assert schema.status == "ng"
    assert schema.detail == "違反"
    assert schema.blocking_pairs == [[0, 1], [2, 0]]


def test_report_item_schema_from_domain_defaults_to_empty_blocking_pairs() -> None:
    schema = ReportItemSchema.from_domain(ReportItem(label="定員遵守", status="ok", detail="良好"))

    assert schema.blocking_pairs == []
