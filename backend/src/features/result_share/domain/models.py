"""結果共有のドメインモデル（保持期間と保存上限の規則）。

frozen dataclass（kw_only）、入力検証は `__post_init__` で ValueError。
日時はすべて UTC の aware datetime を前提とする。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

# 保持期間（日数）の範囲と既定値。発行者が発行時に範囲内から選ぶ。
MIN_RETENTION_DAYS = 1
MAX_RETENTION_DAYS = 30
DEFAULT_RETENTION_DAYS = 7

# 保存する入力（JSON 直列化後の UTF-8 バイト数）の上限。
MAX_SNAPSHOT_BYTES = 256 * 1024


@dataclass(frozen=True, kw_only=True)
class RetentionPeriod:
    """共有データの保持期間。期限を過ぎたデータは削除対象になる。

    Attributes:
        days: 保持日数（MIN_RETENTION_DAYS〜MAX_RETENTION_DAYS）。
    """

    days: int

    def __post_init__(self) -> None:
        if isinstance(self.days, bool) or not MIN_RETENTION_DAYS <= self.days <= MAX_RETENTION_DAYS:
            raise ValueError(
                f"保持期間は {MIN_RETENTION_DAYS}〜{MAX_RETENTION_DAYS} 日の範囲で指定してください"
            )

    def expires_at(self, created_at: datetime) -> datetime:
        """作成日時から保持日数後の有効期限を返す。"""
        return created_at + timedelta(days=self.days)
