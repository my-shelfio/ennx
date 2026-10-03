"""結果共有リポジトリのポート（application 層が定義し infrastructure 層が実装する）。"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True, kw_only=True)
class ResultShareRecord:
    """共有データの保存レコード。

    保存するのはマッチングの入力（snapshot）と作成日時・有効期限のみで、
    実行結果や IP アドレス等の追跡情報は含まない。日時はすべて UTC の aware datetime。
    """

    share_id: str
    view_token: str
    delete_token: str
    snapshot: dict[str, object]
    created_at: datetime
    expires_at: datetime


class ResultShareRepository(Protocol):
    """共有データの保存ポート。

    実装は呼び出し前に期限切れデータの遅延削除（purge_expired）を行える必要が
    ある（遅延削除に加え、無アクセス時でも削除されるよう日次バッチ実行との
    二段構えを前提とする）。
    """

    def purge_expired(self, now: datetime) -> int:
        """期限切れ（expires_at < now）の共有データを削除し、削除件数を返す。"""
        ...

    def create(self, record: ResultShareRecord) -> None:
        """共有データを新規保存する。"""
        ...

    def find_by_view_token(self, token: str) -> ResultShareRecord | None:
        """閲覧用トークンで共有データを取得する（無ければ None）。"""
        ...

    def find_by_delete_token(self, token: str) -> ResultShareRecord | None:
        """削除用トークンで共有データを取得する（無ければ None）。"""
        ...

    def delete(self, share_id: str) -> None:
        """共有データを即時削除する。"""
        ...
