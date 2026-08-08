"""性質レポートの共通データモデル。

service.py（レポート組み立て）と constraints.py（制約レジストリの
report_item 生成）の両方から参照されるため、依存の少ない本モジュールに切り出す
（service ⇄ constraints の循環importを避けるため）。
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ReportItem:
    """性質レポートの 1 項目。status は "ok" | "ng" | "info"。

    Attributes:
        label: 性質名（例: 安定性）。
        status: 判定（"ok" | "ng" | "info"）。
        detail: 判定の説明。
        blocking_pairs: 安定性・弱安定性違反の原因となったブロッキングペア
            （社員 0-index, 部署 0-index）の一覧。該当しない性質・違反なしの
            場合は空リスト。
    """

    label: str
    status: str
    detail: str
    blocking_pairs: list[tuple[int, int]] = field(default_factory=list)
