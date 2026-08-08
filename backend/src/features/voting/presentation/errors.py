"""voting API のエラーハンドラ（RFC 9457 → HTTP 変換）。"""

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from features.voting.application.errors import (
    InvalidVotingInputError,
    VotingClosedError,
    VotingNotClosedError,
    VotingSessionNotFoundError,
    VotingUnavailableError,
)
from shared.presentation.errors import build_problem_response
from shared.presentation.schemas import FieldErrorSchema


def register_voting_error_handlers(app: FastAPI) -> None:
    """アプリに投票機能の RFC 9457 エラーハンドラを登録する。"""

    @app.exception_handler(InvalidVotingInputError)
    async def handle_invalid_voting_input(
        _request: Request, exc: InvalidVotingInputError
    ) -> JSONResponse:
        """投票入力のユースケースエラーを 422 に変換する。"""
        return build_problem_response(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            title="入力が不正です",
            detail="投票入力の検証でエラーが見つかりました。",
            errors=[FieldErrorSchema(field=e.field, message=e.message) for e in exc.errors],
        )

    @app.exception_handler(VotingSessionNotFoundError)
    async def handle_voting_not_found(
        _request: Request, exc: VotingSessionNotFoundError
    ) -> JSONResponse:
        """投票が見つからない（期限切れ含む）を 404 に変換する（存在有無は秘匿）。"""
        return build_problem_response(
            status_code=status.HTTP_404_NOT_FOUND,
            title="見つかりません",
            detail=str(exc),
            errors=[],
        )

    @app.exception_handler(VotingClosedError)
    async def handle_voting_closed(_request: Request, exc: VotingClosedError) -> JSONResponse:
        """締切済みの投票操作を 409 に変換する。"""
        return build_problem_response(
            status_code=status.HTTP_409_CONFLICT,
            title="締切済みです",
            detail=str(exc),
            errors=[],
        )

    @app.exception_handler(VotingNotClosedError)
    async def handle_voting_not_closed(
        _request: Request, exc: VotingNotClosedError
    ) -> JSONResponse:
        """締切前の結果取得を 409 に変換する。"""
        return build_problem_response(
            status_code=status.HTTP_409_CONFLICT,
            title="集計前です",
            detail=str(exc),
            errors=[],
        )

    @app.exception_handler(VotingUnavailableError)
    async def handle_voting_unavailable(
        _request: Request, exc: VotingUnavailableError
    ) -> JSONResponse:
        """保存基盤未構成による投票機能の停止を 503 に変換する。"""
        return build_problem_response(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            title="投票機能は利用できません",
            detail=str(exc),
            errors=[],
        )
