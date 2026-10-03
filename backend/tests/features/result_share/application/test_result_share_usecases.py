"""結果共有ユースケースのテスト（インメモリのフェイクリポジトリを使用）。"""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from features.result_share.application import (
    CleanupExpiredResultShares,
    CreateResultShare,
    DeleteResultShare,
    GetSharedResult,
)
from features.result_share.application.dto import CreateResultShareRequest
from features.result_share.application.errors import (
    InvalidResultShareInputError,
    ResultShareNotFoundError,
    ResultShareTooLargeError,
)
from features.result_share.application.ports import ResultShareRecord
from features.result_share.domain import MAX_SNAPSHOT_BYTES

_SNAPSHOT: dict[str, object] = {
    "constraint_type": "capacity_only",
    "capacities": [1, 1],
    "proposer_prefs": [[1, 2], [2, 1]],
    "receiver_prefs": [[1, 2], [2, 1]],
    "employee_names": ["山田", "佐藤"],
    "department_names": ["営業", "開発"],
}


class FakeResultShareRepository:
    """ポート準拠のインメモリ実装。"""

    def __init__(self) -> None:
        self.records: dict[str, ResultShareRecord] = {}

    def purge_expired(self, now: datetime) -> int:
        expired = [sid for sid, r in self.records.items() if r.expires_at < now]
        for sid in expired:
            del self.records[sid]
        return len(expired)

    def create(self, record: ResultShareRecord) -> None:
        self.records[record.share_id] = record

    def find_by_view_token(self, token: str) -> ResultShareRecord | None:
        return next((r for r in self.records.values() if r.view_token == token), None)

    def find_by_delete_token(self, token: str) -> ResultShareRecord | None:
        return next((r for r in self.records.values() if r.delete_token == token), None)

    def delete(self, share_id: str) -> None:
        self.records.pop(share_id, None)


@pytest.fixture()
def repository() -> FakeResultShareRepository:
    return FakeResultShareRepository()


def _create(repository: FakeResultShareRepository, retention_days: int = 7) -> tuple[str, str]:
    created = CreateResultShare(repository).execute(
        CreateResultShareRequest(snapshot=dict(_SNAPSHOT), retention_days=retention_days)
    )
    return created.view_token, created.delete_token


def _expire(repository: FakeResultShareRepository, view_token: str) -> None:
    """指定した共有データの有効期限を 1 時間前に書き換える（期限経過の再現）。"""
    past = datetime.now(UTC) - timedelta(hours=1)
    repository.records = {
        sid: replace(r, expires_at=past) if r.view_token == view_token else r
        for sid, r in repository.records.items()
    }


class TestCreateResultShare:
    def test_stores_only_input_and_returns_it_by_view_token(
        self, repository: FakeResultShareRepository
    ) -> None:
        view_token, delete_token = _create(repository)
        assert view_token != delete_token
        (record,) = repository.records.values()
        assert record.snapshot == _SNAPSHOT
        view = GetSharedResult(repository).execute(view_token)
        assert view.snapshot == _SNAPSHOT
        assert view.expires_at == record.expires_at

    @pytest.mark.parametrize("retention_days", [1, 7, 30])
    def test_expires_after_retention_days(
        self, repository: FakeResultShareRepository, retention_days: int
    ) -> None:
        created = CreateResultShare(repository).execute(
            CreateResultShareRequest(snapshot=dict(_SNAPSHOT), retention_days=retention_days)
        )
        assert created.expires_at - created.created_at == timedelta(days=retention_days)

    @pytest.mark.parametrize("retention_days", [0, 31, -1])
    def test_retention_out_of_range_is_rejected(
        self, repository: FakeResultShareRepository, retention_days: int
    ) -> None:
        with pytest.raises(InvalidResultShareInputError) as exc_info:
            _create(repository, retention_days=retention_days)
        assert [e.field for e in exc_info.value.errors] == ["retention_days"]
        assert repository.records == {}

    def test_too_large_snapshot_is_rejected(self, repository: FakeResultShareRepository) -> None:
        snapshot = dict(_SNAPSHOT, employee_names=["x" * MAX_SNAPSHOT_BYTES, "佐藤"])
        with pytest.raises(ResultShareTooLargeError):
            CreateResultShare(repository).execute(
                CreateResultShareRequest(snapshot=snapshot, retention_days=7)
            )
        assert repository.records == {}


class TestGetSharedResult:
    def test_unknown_token(self, repository: FakeResultShareRepository) -> None:
        with pytest.raises(ResultShareNotFoundError):
            GetSharedResult(repository).execute("unknown")

    def test_delete_token_is_not_accepted_for_view(
        self, repository: FakeResultShareRepository
    ) -> None:
        _, delete_token = _create(repository)
        with pytest.raises(ResultShareNotFoundError):
            GetSharedResult(repository).execute(delete_token)

    def test_expired_share_is_not_found_and_purged(
        self, repository: FakeResultShareRepository
    ) -> None:
        view_token, _ = _create(repository)
        _expire(repository, view_token)
        with pytest.raises(ResultShareNotFoundError):
            GetSharedResult(repository).execute(view_token)
        assert repository.records == {}


class TestDeleteAndCleanup:
    def test_delete_immediately(self, repository: FakeResultShareRepository) -> None:
        view_token, delete_token = _create(repository)
        DeleteResultShare(repository).execute(delete_token)
        with pytest.raises(ResultShareNotFoundError):
            GetSharedResult(repository).execute(view_token)
        # 削除済みの再削除・閲覧用トークンでの削除は存在秘匿の未検出。
        with pytest.raises(ResultShareNotFoundError):
            DeleteResultShare(repository).execute(delete_token)

    def test_view_token_cannot_delete(self, repository: FakeResultShareRepository) -> None:
        view_token, _ = _create(repository)
        with pytest.raises(ResultShareNotFoundError):
            DeleteResultShare(repository).execute(view_token)
        assert GetSharedResult(repository).execute(view_token).snapshot == _SNAPSHOT

    def test_cleanup_purges_only_expired(self, repository: FakeResultShareRepository) -> None:
        expired_view_token, _ = _create(repository)
        alive_view_token, _ = _create(repository)
        _expire(repository, expired_view_token)
        assert CleanupExpiredResultShares(repository).execute() == 1
        assert repository.find_by_view_token(expired_view_token) is None
        assert GetSharedResult(repository).execute(alive_view_token).snapshot == _SNAPSHOT
