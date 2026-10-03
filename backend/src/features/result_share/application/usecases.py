"""結果共有のユースケース群。

各ユースケースは実行冒頭で期限切れデータの遅延削除（repository.purge_expired）を
行う。トークンは `secrets.token_urlsafe(24)`（192bit）で生成する。
"""

from __future__ import annotations

import json
import secrets
import uuid
from datetime import UTC, datetime

from features.result_share.domain import MAX_SNAPSHOT_BYTES, RetentionPeriod
from shared.application.errors import FieldError

from .dto import CreateResultShareRequest, ResultShareCreated, SharedResultView
from .errors import (
    InvalidResultShareInputError,
    ResultShareNotFoundError,
    ResultShareTooLargeError,
)
from .ports import ResultShareRecord, ResultShareRepository

_NOT_FOUND_MESSAGE = "この共有 URL は削除されたか、有効期限が切れています"


def _now() -> datetime:
    return datetime.now(UTC)


def _snapshot_bytes(snapshot: dict[str, object]) -> int:
    """保存する入力の JSON 直列化後の UTF-8 バイト数。"""
    return len(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))


class CreateResultShare:
    """マッチングの入力を期限付きで保存し、閲覧用・削除用トークンを発行する。"""

    def __init__(self, repository: ResultShareRepository) -> None:
        self._repository = repository

    def execute(self, request: CreateResultShareRequest) -> ResultShareCreated:
        now = _now()
        self._repository.purge_expired(now)
        try:
            retention = RetentionPeriod(days=request.retention_days)
        except ValueError as exc:
            raise InvalidResultShareInputError(
                [FieldError(field="retention_days", message=str(exc))]
            ) from exc
        if _snapshot_bytes(request.snapshot) > MAX_SNAPSHOT_BYTES:
            raise ResultShareTooLargeError(
                f"共有できる入力データは {MAX_SNAPSHOT_BYTES // 1024}KB までです"
            )

        record = ResultShareRecord(
            share_id=str(uuid.uuid4()),
            view_token=secrets.token_urlsafe(24),
            delete_token=secrets.token_urlsafe(24),
            snapshot=dict(request.snapshot),
            created_at=now,
            expires_at=retention.expires_at(now),
        )
        self._repository.create(record)
        return ResultShareCreated(
            view_token=record.view_token,
            delete_token=record.delete_token,
            created_at=record.created_at,
            expires_at=record.expires_at,
        )


class GetSharedResult:
    """閲覧用トークンから保存された入力と有効期限を取得する。"""

    def __init__(self, repository: ResultShareRepository) -> None:
        self._repository = repository

    def execute(self, view_token: str) -> SharedResultView:
        self._repository.purge_expired(_now())
        record = self._repository.find_by_view_token(view_token)
        if record is None:
            raise ResultShareNotFoundError(_NOT_FOUND_MESSAGE)
        return SharedResultView(
            snapshot=dict(record.snapshot),
            created_at=record.created_at,
            expires_at=record.expires_at,
        )


class DeleteResultShare:
    """共有データを即時削除する（削除用トークン）。"""

    def __init__(self, repository: ResultShareRepository) -> None:
        self._repository = repository

    def execute(self, delete_token: str) -> None:
        self._repository.purge_expired(_now())
        record = self._repository.find_by_delete_token(delete_token)
        if record is None:
            raise ResultShareNotFoundError(_NOT_FOUND_MESSAGE)
        self._repository.delete(record.share_id)


class CleanupExpiredResultShares:
    """期限切れの共有データを一括削除する（日次 cron / 遅延削除の保証側）。"""

    def __init__(self, repository: ResultShareRepository) -> None:
        self._repository = repository

    def execute(self) -> int:
        return self._repository.purge_expired(_now())
