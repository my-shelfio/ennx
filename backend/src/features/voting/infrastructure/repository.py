"""VotingRepository の SQLAlchemy Core 実装。"""

from __future__ import annotations

from datetime import UTC, datetime

import sqlalchemy as sa
from sqlalchemy.engine import Engine, Row

from features.voting.application.ports import BallotRecord, VotingSessionRecord

from .db import voting_ballots, voting_sessions


def _to_text(value: datetime) -> str:
    """UTC の aware datetime を固定書式の ISO-8601 文字列にする。"""
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")


def _from_text(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _record_from_row(row: Row[tuple[object, ...]]) -> VotingSessionRecord:
    mapping = row._mapping
    closed_at = mapping["closed_at"]
    return VotingSessionRecord(
        session_id=str(mapping["session_id"]),
        participant_token=str(mapping["participant_token"]),
        admin_token=str(mapping["admin_token"]),
        title=str(mapping["title"]),
        options=[str(v) for v in mapping["options"]],
        method=str(mapping["method"]),
        deadline=_from_text(str(mapping["deadline"])),
        expires_at=_from_text(str(mapping["expires_at"])),
        created_at=_from_text(str(mapping["created_at"])),
        closed_at=_from_text(str(closed_at)) if closed_at is not None else None,
    )


class SqlVotingRepository:
    """RDB（Neon PostgreSQL。テストでは SQLite）による投票の保存実装。"""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def purge_expired(self, now: datetime) -> int:
        with self._engine.begin() as conn:
            expired = sa.select(voting_sessions.c.session_id).where(
                voting_sessions.c.expires_at < _to_text(now)
            )
            session_ids = [str(row[0]) for row in conn.execute(expired)]
            if not session_ids:
                return 0
            # SQLite は FK の ON DELETE CASCADE が既定で無効のため明示削除する。
            conn.execute(
                sa.delete(voting_ballots).where(voting_ballots.c.session_id.in_(session_ids))
            )
            conn.execute(
                sa.delete(voting_sessions).where(voting_sessions.c.session_id.in_(session_ids))
            )
            return len(session_ids)

    def create_session(self, record: VotingSessionRecord) -> None:
        with self._engine.begin() as conn:
            conn.execute(
                sa.insert(voting_sessions).values(
                    session_id=record.session_id,
                    participant_token=record.participant_token,
                    admin_token=record.admin_token,
                    title=record.title,
                    options=record.options,
                    method=record.method,
                    deadline=_to_text(record.deadline),
                    expires_at=_to_text(record.expires_at),
                    created_at=_to_text(record.created_at),
                    closed_at=None,
                )
            )

    def _find_by(self, column: sa.Column[str], token: str) -> VotingSessionRecord | None:
        with self._engine.connect() as conn:
            row = conn.execute(sa.select(voting_sessions).where(column == token)).first()
        return _record_from_row(row) if row is not None else None

    def find_by_participant_token(self, token: str) -> VotingSessionRecord | None:
        return self._find_by(voting_sessions.c.participant_token, token)

    def find_by_admin_token(self, token: str) -> VotingSessionRecord | None:
        return self._find_by(voting_sessions.c.admin_token, token)

    def upsert_ballot(self, session_id: str, ballot: BallotRecord) -> None:
        now_text = _to_text(datetime.now(UTC))
        with self._engine.begin() as conn:
            # 上書き判定キーは voter_name（前後空白のみ除去済みのニックネーム）。
            # 同一セッション内で同じニックネームなら、別端末・別ブラウザからの
            # 送信でも上書きする。
            deleted = conn.execute(
                sa.delete(voting_ballots).where(
                    voting_ballots.c.session_id == session_id,
                    voting_ballots.c.voter_name == ballot.voter_name,
                )
            )
            del deleted  # 上書き（delete → insert）。件数は使わない。
            conn.execute(
                sa.insert(voting_ballots).values(
                    session_id=session_id,
                    voter_name=ballot.voter_name,
                    content=ballot.content,
                    created_at=now_text,
                )
            )

    def list_ballots(self, session_id: str) -> list[BallotRecord]:
        with self._engine.connect() as conn:
            rows = conn.execute(
                sa.select(voting_ballots)
                .where(voting_ballots.c.session_id == session_id)
                .order_by(voting_ballots.c.created_at)
            ).all()
        return [
            BallotRecord(
                voter_name=str(row._mapping["voter_name"]),
                content=dict(row._mapping["content"]),
            )
            for row in rows
        ]

    def close_session(self, session_id: str, closed_at: datetime) -> None:
        with self._engine.begin() as conn:
            conn.execute(
                sa.update(voting_sessions)
                .where(voting_sessions.c.session_id == session_id)
                .values(closed_at=_to_text(closed_at))
            )

    def delete_session(self, session_id: str) -> None:
        with self._engine.begin() as conn:
            conn.execute(sa.delete(voting_ballots).where(voting_ballots.c.session_id == session_id))
            conn.execute(
                sa.delete(voting_sessions).where(voting_sessions.c.session_id == session_id)
            )
