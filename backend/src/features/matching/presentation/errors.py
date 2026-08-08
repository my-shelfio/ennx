"""matching API のエラーハンドラ（RFC 9457 → HTTP 変換）。"""

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from features.matching.application.errors import InvalidMatchingInputError
from shared.presentation.errors import build_problem_response
from shared.presentation.schemas import FieldErrorSchema


def register_matching_error_handlers(app: FastAPI) -> None:
    """アプリにマッチング機能の RFC 9457 エラーハンドラを登録する。"""

    @app.exception_handler(InvalidMatchingInputError)
    async def handle_invalid_matching_input(
        _request: Request, exc: InvalidMatchingInputError
    ) -> JSONResponse:
        """application 層のユースケースエラーを 422 に変換する。"""
        return build_problem_response(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            title="入力が不正です",
            detail="マッチング入力の検証でエラーが見つかりました。",
            errors=[FieldErrorSchema(field=e.field, message=e.message) for e in exc.errors],
        )
