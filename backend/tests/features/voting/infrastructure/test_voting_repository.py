"""SqlVotingRepository の統合テスト（SQLite in-memory）。

スキーマはポータブルな型のみ（JSON / String）を使うため、PostgreSQL（本番）と
SQLite（テスト）で同一のテーブル定義を共有できる。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
import sqlalchemy as sa
from sqlalchemy.engine import Engine

from features.voting.application.ports import BallotRecord, VotingSessionRecord
from features.voting.infrastructure import SqlVotingRepository, init_voting_schema


@pytest.fixture()
def engine() -> Engine:
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    init_voting_schema(engine)
    return engine


def _record(session_id: str = "s1", *, expires_in_hours: int = 24) -> VotingSessionRecord:
    now = datetime.now(UTC)
    return VotingSessionRecord(
        session_id=session_id,
        participant_token=f"p-{session_id}",
        admin_token=f"a-{session_id}",
        title="テスト投票",
        options=["案A", "案B"],
        method="ranking",
        deadline=now + timedelta(hours=expires_in_hours),
        expires_at=now + timedelta(hours=expires_in_hours),
        created_at=now,
        closed_at=None,
    )


def test_create_and_find(engine: Engine) -> None:
    repository = SqlVotingRepository(engine)
    record = _record()
    repository.create_session(record)
    found = repository.find_by_participant_token("p-s1")
    assert found is not None
    assert found.title == "テスト投票"
    assert found.options == ["案A", "案B"]
    assert found.closed_at is None
    assert found.deadline == record.deadline
    assert repository.find_by_admin_token("a-s1") is not None
    assert repository.find_by_participant_token("unknown") is None


def test_ballot_upsert_and_list(engine: Engine) -> None:
    repository = SqlVotingRepository(engine)
    repository.create_session(_record())
    repository.upsert_ballot("s1", BallotRecord(voter_name="v1", content={"ranking": [0, 1]}))
    repository.upsert_ballot("s1", BallotRecord(voter_name="v1", content={"ranking": [1, 0]}))
    repository.upsert_ballot("s1", BallotRecord(voter_name="v2", content={"ranking": [0, 1]}))
    ballots = repository.list_ballots("s1")
    assert len(ballots) == 2
    by_name = {b.voter_name: b.content for b in ballots}
    assert by_name["v1"] == {"ranking": [1, 0]}


def test_close_session(engine: Engine) -> None:
    repository = SqlVotingRepository(engine)
    repository.create_session(_record())
    closed_at = datetime.now(UTC)
    repository.close_session("s1", closed_at)
    found = repository.find_by_admin_token("a-s1")
    assert found is not None and found.closed_at == closed_at


def test_purge_expired_deletes_sessions_and_ballots(engine: Engine) -> None:
    repository = SqlVotingRepository(engine)
    repository.create_session(_record("s1", expires_in_hours=-1))
    repository.create_session(_record("s2", expires_in_hours=24))
    repository.upsert_ballot("s1", BallotRecord(voter_name="v1", content={"ranking": [0, 1]}))
    deleted = repository.purge_expired(datetime.now(UTC))
    assert deleted == 1
    assert repository.find_by_participant_token("p-s1") is None
    assert repository.find_by_participant_token("p-s2") is not None
    assert repository.list_ballots("s1") == []


def test_delete_session(engine: Engine) -> None:
    repository = SqlVotingRepository(engine)
    repository.create_session(_record())
    repository.upsert_ballot("s1", BallotRecord(voter_name="v1", content={"ranking": [0, 1]}))
    repository.delete_session("s1")
    assert repository.find_by_participant_token("p-s1") is None
    assert repository.list_ballots("s1") == []
