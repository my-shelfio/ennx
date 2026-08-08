"""投票リポジトリのポート（application 層が定義し infrastructure 層が実装する）。"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True, kw_only=True)
class VotingSessionRecord:
    """投票セッションの保存レコード。

    IP アドレス等の追跡情報は含まない。ただし投票（BallotRecord）には参加者が
    自己申告する必須のニックネームを含む。日時はすべて UTC の aware datetime。
    """

    session_id: str
    participant_token: str
    admin_token: str
    title: str
    options: list[str]
    method: str
    deadline: datetime
    expires_at: datetime
    created_at: datetime
    closed_at: datetime | None


@dataclass(frozen=True, kw_only=True)
class BallotRecord:
    """投票 1 件の保存レコード。

    voter_name は参加者が入力する必須のニックネーム（本名でなくてよい）で、
    重複投票の判定キーも兼ねる（前後空白のみ除去した完全一致で上書き判定する）。
    """

    voter_name: str
    content: dict[str, object]


class VotingRepository(Protocol):
    """投票セッション・投票内容の保存ポート。

    実装は呼び出し前に期限切れセッションの遅延削除（purge_expired）を
    行える必要がある（遅延削除に加え、無アクセス時でも削除されるよう
    日次バッチ実行との二段構えを前提とする）。
    """

    def purge_expired(self, now: datetime) -> int:
        """期限切れ（expires_at < now）セッションを削除し、削除件数を返す。"""
        ...

    def create_session(self, record: VotingSessionRecord) -> None:
        """投票セッションを新規保存する。"""
        ...

    def find_by_participant_token(self, token: str) -> VotingSessionRecord | None:
        """参加用トークンでセッションを取得する（無ければ None）。"""
        ...

    def find_by_admin_token(self, token: str) -> VotingSessionRecord | None:
        """管理用トークンでセッションを取得する（無ければ None）。"""
        ...

    def upsert_ballot(self, session_id: str, ballot: BallotRecord) -> None:
        """投票を保存する。同一 voter_key の再投票は上書きする。"""
        ...

    def list_ballots(self, session_id: str) -> list[BallotRecord]:
        """セッションの全投票を返す。"""
        ...

    def close_session(self, session_id: str, closed_at: datetime) -> None:
        """セッションを締め切る（closed_at を記録する）。"""
        ...

    def delete_session(self, session_id: str) -> None:
        """セッションと投票内容を即時削除する。"""
        ...
