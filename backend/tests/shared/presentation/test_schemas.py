"""共通スキーマの変換ヘルパーのテスト。"""

from __future__ import annotations

from shared.domain.report import ReportItem
from shared.presentation.schemas import ReportItemSchema


def test_report_item_schema_from_domain_converts_blocking_pairs_to_lists() -> None:
    item = ReportItem(label="安定性", status="ng", detail="違反", blocking_pairs=[(0, 1), (2, 0)])

    assert ReportItemSchema.from_domain(item).blocking_pairs == [[0, 1], [2, 0]]
