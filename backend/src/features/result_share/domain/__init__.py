"""結果共有のドメイン層（純粋なコードのみ、他層・フレームワーク非依存）。"""

from .models import (
    DEFAULT_RETENTION_DAYS,
    MAX_RETENTION_DAYS,
    MAX_SNAPSHOT_BYTES,
    MIN_RETENTION_DAYS,
    RetentionPeriod,
)

__all__ = [
    "DEFAULT_RETENTION_DAYS",
    "MAX_RETENTION_DAYS",
    "MAX_SNAPSHOT_BYTES",
    "MIN_RETENTION_DAYS",
    "RetentionPeriod",
]
