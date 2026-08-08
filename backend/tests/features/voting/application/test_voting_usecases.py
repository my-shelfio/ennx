"""投票ユースケースのテスト（インメモリのフェイクリポジトリを使用）。"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from features.voting.application import (
    CastBallot,
    CleanupExpiredSessions,
    CloseVoting,
    CreateVotingSession,
    DeleteVotingSession,
    GetAdminSession,
    GetParticipantSession,
    GetVotingResults,
)
from features.voting.application.dto import CastBallotRequest, CreateVotingSessionRequest
from features.voting.application.errors import (
    InvalidVotingInputError,
    VotingClosedError,
    VotingNotClosedError,
    VotingSessionNotFoundError,
)
from features.voting.application.ports import BallotRecord, VotingSessionRecord


class FakeVotingRepository:
    """ポート準拠のインメモリ実装。"""

    def __init__(self) -> None:
        self.sessions: dict[str, VotingSessionRecord] = {}
        self.ballots: dict[str, dict[str, BallotRecord]] = {}

    def purge_expired(self, now: datetime) -> int:
        expired = [sid for sid, s in self.sessions.items() if s.expires_at < now]
        for sid in expired:
            del self.sessions[sid]
            self.ballots.pop(sid, None)
        return len(expired)

    def create_session(self, record: VotingSessionRecord) -> None:
        self.sessions[record.session_id] = record
        self.ballots[record.session_id] = {}

    def find_by_participant_token(self, token: str) -> VotingSessionRecord | None:
        return next((s for s in self.sessions.values() if s.participant_token == token), None)

    def find_by_admin_token(self, token: str) -> VotingSessionRecord | None:
        return next((s for s in self.sessions.values() if s.admin_token == token), None)

    def upsert_ballot(self, session_id: str, ballot: BallotRecord) -> None:
        self.ballots[session_id][ballot.voter_name] = ballot

    def list_ballots(self, session_id: str) -> list[BallotRecord]:
        return list(self.ballots.get(session_id, {}).values())

    def close_session(self, session_id: str, closed_at: datetime) -> None:
        record = self.sessions[session_id]
        self.sessions[session_id] = VotingSessionRecord(
            session_id=record.session_id,
            participant_token=record.participant_token,
            admin_token=record.admin_token,
            title=record.title,
            options=record.options,
            method=record.method,
            deadline=record.deadline,
            expires_at=record.expires_at,
            created_at=record.created_at,
            closed_at=closed_at,
        )

    def delete_session(self, session_id: str) -> None:
        self.sessions.pop(session_id, None)
        self.ballots.pop(session_id, None)


@pytest.fixture()
def repository() -> FakeVotingRepository:
    return FakeVotingRepository()


def _create(repository: FakeVotingRepository, method: str = "ranking") -> tuple[str, str]:
    created = CreateVotingSession(repository).execute(
        CreateVotingSessionRequest(
            title="次期プロジェクト名の選定",
            options=["案A", "案B", "案C"],
            method=method,
            deadline=None,
        )
    )
    return created.participant_token, created.admin_token


class TestCreateVotingSession:
    def test_create_and_get(self, repository: FakeVotingRepository) -> None:
        p_token, a_token = _create(repository)
        view = GetParticipantSession(repository).execute(p_token)
        assert view.title == "次期プロジェクト名の選定"
        assert view.options == ["案A", "案B", "案C"]
        assert view.is_closed is False
        admin = GetAdminSession(repository).execute(a_token)
        assert admin.ballot_count == 0
        assert admin.participant_token == p_token
        assert admin.voters == []

    def test_invalid_inputs(self, repository: FakeVotingRepository) -> None:
        with pytest.raises(InvalidVotingInputError) as exc_info:
            CreateVotingSession(repository).execute(
                CreateVotingSessionRequest(
                    title="", options=["案A"], method="unknown", deadline=None
                )
            )
        fields = {e.field for e in exc_info.value.errors}
        assert {"title", "options", "method"} <= fields

    def test_deadline_over_limit(self, repository: FakeVotingRepository) -> None:
        with pytest.raises(InvalidVotingInputError):
            CreateVotingSession(repository).execute(
                CreateVotingSessionRequest(
                    title="t",
                    options=["a", "b"],
                    method="ranking",
                    deadline=datetime.now(UTC) + timedelta(days=8),
                )
            )


class TestCastBallot:
    def test_cast_and_overwrite(self, repository: FakeVotingRepository) -> None:
        p_token, a_token = _create(repository)
        cast = CastBallot(repository)
        cast.execute(
            p_token,
            CastBallotRequest(voter_name="v1", choice=None, ranking=[0, 1, 2], approvals=None),
        )
        cast.execute(
            p_token,
            CastBallotRequest(voter_name="v1", choice=None, ranking=[2, 1, 0], approvals=None),
        )
        admin = GetAdminSession(repository).execute(a_token)
        assert admin.ballot_count == 1
        assert admin.voters == ["v1"]

    def test_overwrite_matches_after_trimming_whitespace_only(
        self, repository: FakeVotingRepository
    ) -> None:
        """前後の空白のみ除去した完全一致で上書き判定する。"""
        p_token, a_token = _create(repository)
        cast = CastBallot(repository)
        cast.execute(
            p_token,
            CastBallotRequest(voter_name="太郎", choice=None, ranking=[0, 1, 2], approvals=None),
        )
        cast.execute(
            p_token,
            CastBallotRequest(
                voter_name="  太郎  ", choice=None, ranking=[2, 1, 0], approvals=None
            ),
        )
        admin = GetAdminSession(repository).execute(a_token)
        assert admin.ballot_count == 1
        assert admin.voters == ["太郎"]

    def test_different_case_is_not_overwritten(self, repository: FakeVotingRepository) -> None:
        """大文字小文字・全角半角は区別する（正規化しない）。"""
        p_token, a_token = _create(repository)
        cast = CastBallot(repository)
        cast.execute(
            p_token,
            CastBallotRequest(voter_name="Taro", choice=None, ranking=[0, 1, 2], approvals=None),
        )
        cast.execute(
            p_token,
            CastBallotRequest(voter_name="taro", choice=None, ranking=[2, 1, 0], approvals=None),
        )
        admin = GetAdminSession(repository).execute(a_token)
        assert admin.ballot_count == 2
        assert set(admin.voters) == {"Taro", "taro"}

    def test_empty_nickname_is_rejected(self, repository: FakeVotingRepository) -> None:
        p_token, _ = _create(repository)
        with pytest.raises(InvalidVotingInputError) as exc_info:
            CastBallot(repository).execute(
                p_token,
                CastBallotRequest(voter_name="", choice=None, ranking=[0, 1, 2], approvals=None),
            )
        assert {e.field for e in exc_info.value.errors} == {"voter_name"}

    def test_whitespace_only_nickname_is_rejected(self, repository: FakeVotingRepository) -> None:
        p_token, _ = _create(repository)
        with pytest.raises(InvalidVotingInputError) as exc_info:
            CastBallot(repository).execute(
                p_token,
                CastBallotRequest(voter_name="   ", choice=None, ranking=[0, 1, 2], approvals=None),
            )
        assert {e.field for e in exc_info.value.errors} == {"voter_name"}

    def test_nickname_over_length_limit_is_rejected(self, repository: FakeVotingRepository) -> None:
        p_token, _ = _create(repository)
        with pytest.raises(InvalidVotingInputError) as exc_info:
            CastBallot(repository).execute(
                p_token,
                CastBallotRequest(
                    voter_name="a" * 51, choice=None, ranking=[0, 1, 2], approvals=None
                ),
            )
        assert {e.field for e in exc_info.value.errors} == {"voter_name"}

    def test_invalid_ballot_content(self, repository: FakeVotingRepository) -> None:
        p_token, _ = _create(repository)
        with pytest.raises(InvalidVotingInputError):
            CastBallot(repository).execute(
                p_token,
                CastBallotRequest(voter_name="v1", choice=None, ranking=[0, 0, 1], approvals=None),
            )

    def test_unknown_token(self, repository: FakeVotingRepository) -> None:
        with pytest.raises(VotingSessionNotFoundError):
            CastBallot(repository).execute(
                "unknown",
                CastBallotRequest(voter_name="v1", choice=None, ranking=[0, 1, 2], approvals=None),
            )

    def test_closed_session_rejects_ballot(self, repository: FakeVotingRepository) -> None:
        p_token, a_token = _create(repository)
        CloseVoting(repository).execute(a_token)
        with pytest.raises(VotingClosedError):
            CastBallot(repository).execute(
                p_token,
                CastBallotRequest(voter_name="v1", choice=None, ranking=[0, 1, 2], approvals=None),
            )


class TestResults:
    def test_results_flow(self, repository: FakeVotingRepository) -> None:
        p_token, a_token = _create(repository)
        cast = CastBallot(repository)
        for key, ranking in (
            ("v1", [0, 1, 2]),
            ("v2", [1, 0, 2]),
            ("v3", [1, 2, 0]),
        ):
            cast.execute(
                p_token,
                CastBallotRequest(voter_name=key, choice=None, ranking=ranking, approvals=None),
            )
        with pytest.raises(VotingNotClosedError):
            GetVotingResults(repository).execute(a_token)
        CloseVoting(repository).execute(a_token)
        results = GetVotingResults(repository).execute(a_token)
        assert results.ballot_count == 3
        assert results.primary.rule == "borda"
        assert {r.rule for r in results.comparison} == {"plurality", "borda", "condorcet"}
        assert results.primary.winners == [1]
        assert set(results.voters) == {"v1", "v2", "v3"}
        labels = [item.label for item in results.report]
        assert "コンドルセ勝者" in labels

    def test_plurality_results(self, repository: FakeVotingRepository) -> None:
        p_token, a_token = _create(repository, method="plurality")
        cast = CastBallot(repository)
        for key, choice in (("v1", 0), ("v2", 0), ("v3", 2)):
            cast.execute(
                p_token,
                CastBallotRequest(voter_name=key, choice=choice, ranking=None, approvals=None),
            )
        CloseVoting(repository).execute(a_token)
        results = GetVotingResults(repository).execute(a_token)
        assert results.primary.rule == "plurality"
        assert results.primary.winners == [0]
        assert results.report == []


class TestDeleteAndCleanup:
    def test_delete(self, repository: FakeVotingRepository) -> None:
        p_token, a_token = _create(repository)
        DeleteVotingSession(repository).execute(a_token)
        with pytest.raises(VotingSessionNotFoundError):
            GetParticipantSession(repository).execute(p_token)

    def test_cleanup_purges_expired(self, repository: FakeVotingRepository) -> None:
        p_token, _ = _create(repository)
        record = next(iter(repository.sessions.values()))
        expired = VotingSessionRecord(
            session_id=record.session_id,
            participant_token=record.participant_token,
            admin_token=record.admin_token,
            title=record.title,
            options=record.options,
            method=record.method,
            deadline=record.deadline,
            expires_at=datetime.now(UTC) - timedelta(hours=1),
            created_at=record.created_at,
            closed_at=None,
        )
        repository.sessions[record.session_id] = expired
        assert CleanupExpiredSessions(repository).execute() == 1
        with pytest.raises(VotingSessionNotFoundError):
            GetParticipantSession(repository).execute(p_token)
