"""マッチング結果の共有エンドポイント。

バージョン非依存（prefix は /result-share のみ）。API バージョンの prefix（/api/v1 等）は
backend/src/api/vN/router.py が include 時に付与する。

マッチングの入力のみを期限付きで保存し、推測不能トークンの閲覧用 URL で共有する
（結果は保存せず、閲覧画面がマッチング実行 API で再計算する）。リポジトリは DI
（`get_result_share_repository`）で受け取り、合成ルート（main.py）が infrastructure
実装を注入する（presentation は infrastructure に依存しない）。
"""

from __future__ import annotations

import hmac
import os
from typing import Annotated

from fastapi import APIRouter, Depends, Header, status

from features.result_share.application import (
    CleanupExpiredResultShares,
    CreateResultShare,
    DeleteResultShare,
    GetSharedResult,
)
from features.result_share.application.errors import (
    ResultShareNotFoundError,
    ResultShareUnavailableError,
)
from features.result_share.application.ports import ResultShareRepository
from features.result_share.presentation.schemas import (
    ResultShareCleanupResponseSchema,
    ResultShareCreatedSchema,
    ResultShareCreateSchema,
    SharedResultSchema,
)
from shared.presentation.errors import ProblemDetail

_CLEANUP_KEY_ENV = "ENNX_CLEANUP_KEY"

router = APIRouter(prefix="/result-share", tags=["result-share"])


def get_result_share_repository() -> ResultShareRepository:
    """結果共有リポジトリの DI フック。

    合成ルート（main.py）が `DATABASE_URL` 設定時に infrastructure 実装で
    上書きする。未構成のままでは結果共有を提供できない（503）。
    """
    raise ResultShareUnavailableError("結果の共有は現在利用できません（保存基盤が未構成です）")


RepositoryDep = Annotated[ResultShareRepository, Depends(get_result_share_repository)]

_ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    status.HTTP_404_NOT_FOUND: {"model": ProblemDetail},
    status.HTTP_410_GONE: {"model": ProblemDetail},
    status.HTTP_413_CONTENT_TOO_LARGE: {"model": ProblemDetail},
    status.HTTP_422_UNPROCESSABLE_CONTENT: {"model": ProblemDetail},
    status.HTTP_503_SERVICE_UNAVAILABLE: {"model": ProblemDetail},
}


@router.post(
    "/snapshots",
    summary="閲覧用 URL を発行する",
    status_code=status.HTTP_201_CREATED,
    responses=_ERROR_RESPONSES,
)
def create_share(
    request: ResultShareCreateSchema, repository: RepositoryDep
) -> ResultShareCreatedSchema:
    """マッチングの入力を期限付きで保存し、閲覧用・削除用トークンを返す。"""
    created = CreateResultShare(repository).execute(request.to_dto())
    return ResultShareCreatedSchema.from_dto(created)


@router.get(
    "/v/{view_token}",
    summary="共有されたマッチングの入力を取得する（閲覧者用）",
    responses=_ERROR_RESPONSES,
)
def get_shared_result(view_token: str, repository: RepositoryDep) -> SharedResultSchema:
    """閲覧用トークンから保存された入力と自動削除日時を返す。"""
    view = GetSharedResult(repository).execute(view_token)
    return SharedResultSchema.from_dto(view)


@router.delete(
    "/d/{delete_token}",
    summary="共有データを削除する（発行者用）",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=_ERROR_RESPONSES,
)
def delete_share(delete_token: str, repository: RepositoryDep) -> None:
    """削除用トークンの共有データを即時削除する（以後、閲覧用 URL は 404 になる）。"""
    DeleteResultShare(repository).execute(delete_token)


@router.post(
    "/cleanup",
    summary="期限切れの共有データを削除する（日次 cron 用）",
    responses=_ERROR_RESPONSES,
)
def cleanup(
    repository: RepositoryDep,
    x_cleanup_key: Annotated[str | None, Header()] = None,
) -> ResultShareCleanupResponseSchema:
    """管理キー（環境変数 ENNX_CLEANUP_KEY）で保護された一括削除。

    遅延削除（各 API アクセス時）を補完し、無アクセス時でも期限超過後
    24 時間以内の削除を保証する（日次バッチから定期実行する運用を前提とする）。
    """
    expected = os.environ.get(_CLEANUP_KEY_ENV)
    if not expected or x_cleanup_key is None or not hmac.compare_digest(x_cleanup_key, expected):
        # キー未設定・不一致は存在秘匿のため 404 相当として扱う。
        raise ResultShareNotFoundError("この操作は実行できません")
    deleted = CleanupExpiredResultShares(repository).execute()
    return ResultShareCleanupResponseSchema(deleted=deleted)
