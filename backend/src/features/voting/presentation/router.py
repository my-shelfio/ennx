"""投票・合意形成エンドポイント。

バージョン非依存（prefix は /voting のみ）。API バージョンの prefix（/api/v1 等）は
backend/src/api/vN/router.py が include 時に付与する。

匿名参加 URL（推測不能トークン）方式。
リポジトリは DI（`get_voting_repository`）で受け取り、合成ルート（main.py）が
infrastructure 実装を注入する（presentation は infrastructure に依存しない）。
"""

from __future__ import annotations

import hmac
import os
from typing import Annotated

from fastapi import APIRouter, Depends, Header, status

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
from features.voting.application.errors import VotingSessionNotFoundError, VotingUnavailableError
from features.voting.application.ports import VotingRepository
from features.voting.presentation.schemas import (
    AdminSessionSchema,
    BallotSchema,
    CleanupResponseSchema,
    ParticipantSessionSchema,
    VotingResultsSchema,
    VotingSessionCreatedSchema,
    VotingSessionCreateSchema,
)
from shared.presentation.errors import ProblemDetail

_CLEANUP_KEY_ENV = "ENNX_CLEANUP_KEY"

router = APIRouter(prefix="/voting", tags=["voting"])


def get_voting_repository() -> VotingRepository:
    """投票リポジトリの DI フック。

    合成ルート（main.py）が `DATABASE_URL` 設定時に infrastructure 実装で
    上書きする。未構成のままでは投票機能を提供できない（503）。
    """
    raise VotingUnavailableError("投票機能は現在利用できません（保存基盤が未構成です）")


RepositoryDep = Annotated[VotingRepository, Depends(get_voting_repository)]

_ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    status.HTTP_404_NOT_FOUND: {"model": ProblemDetail},
    status.HTTP_409_CONFLICT: {"model": ProblemDetail},
    status.HTTP_422_UNPROCESSABLE_CONTENT: {"model": ProblemDetail},
    status.HTTP_503_SERVICE_UNAVAILABLE: {"model": ProblemDetail},
}


@router.post(
    "/sessions",
    summary="投票を作成する",
    status_code=status.HTTP_201_CREATED,
    responses=_ERROR_RESPONSES,
)
def create_session(
    request: VotingSessionCreateSchema, repository: RepositoryDep
) -> VotingSessionCreatedSchema:
    """投票セッションを作成し、参加用・管理用トークンを返す。"""
    created = CreateVotingSession(repository).execute(request.to_dto())
    return VotingSessionCreatedSchema.from_dto(created)


@router.get(
    "/p/{participant_token}",
    summary="投票の公開情報を取得する（参加者用）",
    responses=_ERROR_RESPONSES,
)
def get_participant_session(
    participant_token: str, repository: RepositoryDep
) -> ParticipantSessionSchema:
    """参加用トークンからタイトル・選択肢・方式・締切を返す。"""
    view = GetParticipantSession(repository).execute(participant_token)
    return ParticipantSessionSchema.from_dto(view)


@router.post(
    "/p/{participant_token}/ballots",
    summary="投票する",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=_ERROR_RESPONSES,
)
def cast_ballot(participant_token: str, request: BallotSchema, repository: RepositoryDep) -> None:
    """投票を受け付ける（同一ニックネームの再投票は上書き）。"""
    CastBallot(repository).execute(participant_token, request.to_dto())


@router.get(
    "/a/{admin_token}",
    summary="投票の管理情報を取得する（主催者用）",
    responses=_ERROR_RESPONSES,
)
def get_admin_session(admin_token: str, repository: RepositoryDep) -> AdminSessionSchema:
    """管理用トークンからセッション情報（投票数含む）を返す。"""
    view = GetAdminSession(repository).execute(admin_token)
    return AdminSessionSchema.from_dto(view)


@router.post(
    "/a/{admin_token}/close",
    summary="投票を締め切る",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=_ERROR_RESPONSES,
)
def close_voting(admin_token: str, repository: RepositoryDep) -> None:
    """投票を締め切り、集計可能な状態にする。"""
    CloseVoting(repository).execute(admin_token)


@router.get(
    "/a/{admin_token}/results",
    summary="集計結果と性質レポートを取得する",
    responses=_ERROR_RESPONSES,
)
def get_results(admin_token: str, repository: RepositoryDep) -> VotingResultsSchema:
    """締切後の集計結果（主結果・ルール比較・性質レポート）を返す。"""
    results = GetVotingResults(repository).execute(admin_token)
    return VotingResultsSchema.from_dto(results)


@router.delete(
    "/a/{admin_token}",
    summary="投票を削除する",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=_ERROR_RESPONSES,
)
def delete_session(admin_token: str, repository: RepositoryDep) -> None:
    """投票セッションと投票内容を即時削除する。"""
    DeleteVotingSession(repository).execute(admin_token)


@router.post(
    "/cleanup",
    summary="期限切れの投票データを削除する（日次 cron 用）",
    responses=_ERROR_RESPONSES,
)
def cleanup(
    repository: RepositoryDep,
    x_cleanup_key: Annotated[str | None, Header()] = None,
) -> CleanupResponseSchema:
    """管理キー（環境変数 ENNX_CLEANUP_KEY）で保護された一括削除。

    遅延削除（各 API アクセス時）を補完し、無アクセス時でも期限超過後
    24 時間以内の削除を保証する（日次バッチから定期実行する運用を前提とする）。
    """
    expected = os.environ.get(_CLEANUP_KEY_ENV)
    if not expected or x_cleanup_key is None or not hmac.compare_digest(x_cleanup_key, expected):
        # キー未設定・不一致は存在秘匿のため 404 相当として扱う。
        raise VotingSessionNotFoundError("この操作は実行できません")
    deleted = CleanupExpiredSessions(repository).execute()
    return CleanupResponseSchema(deleted=deleted)
