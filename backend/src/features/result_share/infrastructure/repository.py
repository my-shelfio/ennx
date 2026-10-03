"""ResultShareRepository の SQLAlchemy Core 実装。"""

from __future__ import annotations

from datetime import UTC, datetime

import sqlalchemy as sa
from sqlalchemy.engine import Engine, Row

from features.result_share.application.ports import ResultShareRecord

from .db import result_shares


def _to_text(value: datetime) -> str:
    """UTC の aware datetime を固定書式の ISO-8601 文字列にする。"""
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")


def _from_text(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _record_from_row(row: Row[tuple[object, ...]]) -> ResultShareRecord:
    mapping = row._mapping
    return ResultShareRecord(
        share_id=str(mapping["share_id"]),
        view_token=str(mapping["view_token"]),
        delete_token=str(mapping["delete_token"]),
        snapshot=dict(mapping["snapshot"]),
        created_at=_from_text(str(mapping["created_at"])),
        expires_at=_from_text(str(mapping["expires_at"])),
    )


class SqlResultShareRepository:
    """RDB（Neon PostgreSQL。テストでは SQLite）による共有データの保存実装。"""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def purge_expired(self, now: datetime) -> int:
        with self._engine.begin() as conn:
            result = conn.execute(
                sa.delete(result_shares).where(result_shares.c.expires_at < _to_text(now))
            )
            return result.rowcount

    def create(self, record: ResultShareRecord) -> None:
        with self._engine.begin() as conn:
            conn.execute(
                sa.insert(result_shares).values(
                    share_id=record.share_id,
                    view_token=record.view_token,
                    delete_token=record.delete_token,
                    snapshot=record.snapshot,
                    created_at=_to_text(record.created_at),
                    expires_at=_to_text(record.expires_at),
                )
            )

    def _find_by(self, column: sa.Column[str], token: str) -> ResultShareRecord | None:
        with self._engine.connect() as conn:
            row = conn.execute(sa.select(result_shares).where(column == token)).first()
        return _record_from_row(row) if row is not None else None

    def find_by_view_token(self, token: str) -> ResultShareRecord | None:
        return self._find_by(result_shares.c.view_token, token)

    def find_by_delete_token(self, token: str) -> ResultShareRecord | None:
        return self._find_by(result_shares.c.delete_token, token)

    def delete(self, share_id: str) -> None:
        with self._engine.begin() as conn:
            conn.execute(sa.delete(result_shares).where(result_shares.c.share_id == share_id))
