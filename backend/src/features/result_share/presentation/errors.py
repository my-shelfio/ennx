"""result_share API のエラーハンドラ（RFC 9457 → HTTP 変換）。"""

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from features.result_share.application.errors import (
    InvalidResultShareInputError,
    ResultShareNotFoundError,
    ResultShareTooLargeError,
    ResultShareUnavailableError,
)
from shared.presentation.errors import build_problem_response
from shared.presentation.schemas import FieldErrorSchema


def register_result_share_error_handlers(app: FastAPI) -> None:
    """アプリに結果共有機能の RFC 9457 エラーハンドラを登録する。"""

    @app.exception_handler(InvalidResultShareInputError)
    async def handle_invalid_result_share_input(
        _request: Request, exc: InvalidResultShareInputError
    ) -> JSONResponse:
        """発行入力のユースケースエラーを 422 に変換する。"""
        return build_problem_response(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            title="入力が不正です",
            detail="閲覧用 URL の発行内容の検証でエラーが見つかりました。",
            errors=[FieldErrorSchema.from_domain(e) for e in exc.errors],
        )

    @app.exception_handler(ResultShareNotFoundError)
    async def handle_result_share_not_found(
        _request: Request, exc: ResultShareNotFoundError
    ) -> JSONResponse:
        """共有データが見つからない（期限切れ含む）を 404 に変換する（存在有無は秘匿）。"""
        return build_problem_response(
            status_code=status.HTTP_404_NOT_FOUND,
            title="見つかりません",
            detail=str(exc),
            errors=[],
        )

    @app.exception_handler(ResultShareTooLargeError)
    async def handle_result_share_too_large(
        _request: Request, exc: ResultShareTooLargeError
    ) -> JSONResponse:
        """保存上限を超える入力を 413 に変換する。"""
        return build_problem_response(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            title="入力データが大きすぎます",
            detail=str(exc),
            errors=[],
        )

    @app.exception_handler(ResultShareUnavailableError)
    async def handle_result_share_unavailable(
        _request: Request, exc: ResultShareUnavailableError
    ) -> JSONResponse:
        """保存基盤未構成による結果共有の停止を 503 に変換する。"""
        return build_problem_response(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            title="結果の共有は利用できません",
            detail=str(exc),
            errors=[],
        )
