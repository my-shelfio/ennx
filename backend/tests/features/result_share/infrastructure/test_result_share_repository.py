"""SqlResultShareRepository の統合テスト（SQLite in-memory）。

スキーマはポータブルな型のみ（JSON / String）を使うため、PostgreSQL（本番）と
SQLite（テスト）で同一のテーブル定義を共有できる。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
import sqlalchemy as sa
from sqlalchemy.engine import Engine

from features.result_share.application.ports import ResultShareRecord
from features.result_share.infrastructure import (
    SqlResultShareRepository,
    init_result_share_schema,
)

_SNAPSHOT: dict[str, object] = {
    "constraint_type": "capacity_only",
    "capacities": [1, 1],
    "proposer_prefs": [[1, 2], [2, 1]],
    "receiver_prefs": [[1, 2], [2, 1]],
    "employee_names": ["山田", "佐藤"],
    "department_names": None,
}


@pytest.fixture()
def engine() -> Engine:
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    init_result_share_schema(engine)
    return engine


def _record(share_id: str = "s1", *, expires_in_hours: int = 24) -> ResultShareRecord:
    now = datetime.now(UTC)
    return ResultShareRecord(
        share_id=share_id,
        view_token=f"v-{share_id}",
        delete_token=f"d-{share_id}",
        snapshot=dict(_SNAPSHOT),
        created_at=now,
        expires_at=now + timedelta(hours=expires_in_hours),
    )


def test_create_and_find(engine: Engine) -> None:
    repository = SqlResultShareRepository(engine)
    record = _record()
    repository.create(record)
    assert repository.find_by_view_token("v-s1") == record
    assert repository.find_by_delete_token("d-s1") == record
    assert repository.find_by_view_token("d-s1") is None
    assert repository.find_by_delete_token("v-s1") is None


def test_purge_expired_deletes_only_expired(engine: Engine) -> None:
    repository = SqlResultShareRepository(engine)
    repository.create(_record("s1", expires_in_hours=-1))
    repository.create(_record("s2", expires_in_hours=24))
    assert repository.purge_expired(datetime.now(UTC)) == 1
    assert repository.find_by_view_token("v-s1") is None
    assert repository.find_by_view_token("v-s2") is not None
    assert repository.purge_expired(datetime.now(UTC)) == 0


def test_delete(engine: Engine) -> None:
    repository = SqlResultShareRepository(engine)
    repository.create(_record("s1"))
    repository.create(_record("s2"))
    repository.delete("s1")
    assert repository.find_by_view_token("v-s1") is None
    assert repository.find_by_view_token("v-s2") is not None
