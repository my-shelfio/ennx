"""assignment 機能の API ルータ集約（割り当て実行・検証・メタ情報・サンプル）。

バージョン非依存（prefix は /assignment・/meta のみ）。API バージョンの
prefix（/api/v1 等）は backend/src/api/vN/router.py が include 時に付与する。

ステートレス API: リクエストに設定＋希望順位の全量を含め、サーバーは
リクエスト間で状態を持たない。
"""

from __future__ import annotations

from fastapi import APIRouter, status

from features.assignment.application.usecases import (
    GetAssignmentConstraintMeta,
    GetAssignmentSample,
    GetUpperConstraintMeta,
    RunAssignment,
    ValidateAssignmentInput,
)
from features.assignment.presentation.schemas.assignment import (
    AssignmentConstraintTypeListResponse,
    AssignmentConstraintTypeMetaSchema,
    AssignmentRequestSchema,
    AssignmentRunResponse,
    AssignmentValidateResponse,
    UpperConstraintMetaListResponse,
    UpperConstraintMetaSchema,
)
from shared.presentation.errors import ProblemDetail

router = APIRouter()

_assignment_router = APIRouter(prefix="/assignment", tags=["assignment"])
_meta_router = APIRouter(prefix="/meta", tags=["meta"])


@_assignment_router.post(
    "/run",
    summary="割り当てを実行する",
    responses={status.HTTP_422_UNPROCESSABLE_CONTENT: {"model": ProblemDetail}},
)
def run_assignment(request: AssignmentRequestSchema) -> AssignmentRunResponse:
    """設定＋希望順位を受け取り、期待割当・くじ・性質レポート・イベントログを返す。"""
    outcome = RunAssignment().execute(request.to_dto())
    return AssignmentRunResponse.from_dto(outcome)


@_assignment_router.post(
    "/validate",
    summary="割り当て入力を事前検証する",
    responses={status.HTTP_422_UNPROCESSABLE_CONTENT: {"model": ProblemDetail}},
)
def validate_assignment_input(request: AssignmentRequestSchema) -> AssignmentValidateResponse:
    """入力の妥当性のみを検証する（実行しない。ウィザードのステップ間検証用）。"""
    outcome = ValidateAssignmentInput().execute(request.to_dto())
    return AssignmentValidateResponse.from_dto(outcome)


@_assignment_router.get("/sample", summary="デモ用サンプル入力を取得する")
def get_assignment_sample() -> AssignmentRequestSchema:
    """案件アサイン風のサンプル入力（そのまま run に送信可能）を返す。"""
    return AssignmentRequestSchema.from_dto(GetAssignmentSample().execute())


@_meta_router.get("/assignment-constraint-types", summary="割り当ての制約種別一覧を取得する")
def get_assignment_constraint_types() -> AssignmentConstraintTypeListResponse:
    """設定ウィザードで選択可能な制約種別とメカニズムのメタ情報を返す。"""
    metas = GetAssignmentConstraintMeta().execute()
    return AssignmentConstraintTypeListResponse(
        constraint_types=[AssignmentConstraintTypeMetaSchema.from_dto(meta) for meta in metas]
    )


@_meta_router.get(
    "/assignment-upper-constraint-types", summary="割り当ての追加制約種別一覧を取得する"
)
def get_assignment_upper_constraint_types() -> UpperConstraintMetaListResponse:
    """追加の上限制約種別と、パラメータのフィールド定義を返す。"""
    metas = GetUpperConstraintMeta().execute()
    return UpperConstraintMetaListResponse(
        upper_constraint_types=[UpperConstraintMetaSchema.from_dto(meta) for meta in metas]
    )


router.include_router(_assignment_router)
router.include_router(_meta_router)
