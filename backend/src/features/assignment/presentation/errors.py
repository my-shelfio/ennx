"""assignment API のエラーハンドラ（RFC 9457 → HTTP 変換）。"""

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from features.assignment.application.errors import InvalidAssignmentInputError
from shared.presentation.errors import build_problem_response
from shared.presentation.schemas import FieldErrorSchema


def register_assignment_error_handlers(app: FastAPI) -> None:
    """アプリに割り当て機能の RFC 9457 エラーハンドラを登録する。"""

    @app.exception_handler(InvalidAssignmentInputError)
    async def handle_invalid_assignment_input(
        _request: Request, exc: InvalidAssignmentInputError
    ) -> JSONResponse:
        """application 層のユースケースエラーを 422 に変換する。"""
        return build_problem_response(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            title="入力が不正です",
            detail="割り当て入力の検証でエラーが見つかりました。",
            errors=[FieldErrorSchema(field=e.field, message=e.message) for e in exc.errors],
        )
