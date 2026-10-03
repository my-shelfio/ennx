"""結果共有ユースケースの DTO（presentation 層との境界データ）。"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, kw_only=True)
class CreateResultShareRequest:
    """閲覧用 URL 発行の入力。

    snapshot はマッチングの入力（形式は presentation 層で検証済みの JSON 互換の
    辞書）。結果は保存せず、閲覧時に入力から再計算する。
    """

    snapshot: dict[str, object]
    retention_days: int


@dataclass(frozen=True, kw_only=True)
class ResultShareCreated:
    """閲覧用 URL 発行の結果（トークンはこの応答でのみ返す）。"""

    view_token: str
    delete_token: str
    created_at: datetime
    expires_at: datetime


@dataclass(frozen=True, kw_only=True)
class SharedResultView:
    """閲覧者向けの共有データ（保存された入力と有効期限）。"""

    snapshot: dict[str, object]
    created_at: datetime
    expires_at: datetime
