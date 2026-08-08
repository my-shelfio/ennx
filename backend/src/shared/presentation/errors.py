"""RFC 9457（Problem Details for HTTP APIs）形式のエラーレスポンスの共通部品。

`ProblemDetail`・`build_problem_response` は各 feature のエラーハンドラ
（features/matching/presentation/errors.py、features/voting/presentation/errors.py）
が共通で使う。Pydantic の RequestValidationError（型・上限検証）はどの feature にも
属さないため、本モジュールでハンドラ登録まで行う。
"""

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from shared.presentation.schemas import FieldErrorSchema

PROBLEM_JSON_MEDIA_TYPE = "application/problem+json"

# RFC 9457: type を省略した場合の既定値は "about:blank"。
# 現時点では専用のエラー型 URI を運用しないため既定値を明示する。
_PROBLEM_TYPE_BLANK = "about:blank"


class ProblemDetail(BaseModel):
    """RFC 9457 のエラーレスポンスボディ（OpenAPI ドキュメント用）。"""

    type: str = Field(default=_PROBLEM_TYPE_BLANK, description="エラー型の URI")
    title: str = Field(description="エラーの種類の短い説明")
    status: int = Field(description="HTTP ステータスコード")
    detail: str = Field(description="このエラーの説明")
    errors: list[FieldErrorSchema] = Field(
        default_factory=list, description="フィールド単位の入力エラー"
    )


def build_problem_response(
    status_code: int, title: str, detail: str, errors: list[FieldErrorSchema]
) -> JSONResponse:
    """RFC 9457 形式の JSONResponse を組み立てる。"""
    problem = ProblemDetail(title=title, status=status_code, detail=detail, errors=errors)
    return JSONResponse(
        status_code=status_code,
        content=problem.model_dump(),
        media_type=PROBLEM_JSON_MEDIA_TYPE,
    )


def _format_loc(loc: tuple[int | str, ...]) -> str | None:
    """Pydantic のエラー位置をリクエストボディのフィールド名に整形する。

    例: ("body", "proposer_prefs") → "proposer_prefs"、
    ("body", "constraints", 0, "type") → "constraints[0].type"。
    ボディ以外（クエリ等）や位置が空の場合は None。
    """
    parts = [p for p in loc if p != "body"]
    if not parts:
        return None
    field = ""
    for part in parts:
        if isinstance(part, int):
            field += f"[{part}]"
        else:
            field += f".{part}" if field else str(part)
    return field


def register_request_validation_handler(app: FastAPI) -> None:
    """Pydantic の RequestValidationError（型・必須・上限）を 422 に変換する。

    どの feature にも属さない共通ハンドラのため main.py から直接登録する。
    """

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = [
            FieldErrorSchema(
                field=_format_loc(tuple(error.get("loc", ()))),
                message=str(error.get("msg", "入力が不正です")),
            )
            for error in exc.errors()
        ]
        return build_problem_response(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            title="リクエスト形式が不正です",
            detail="リクエストボディの検証でエラーが見つかりました。",
            errors=errors,
        )
