"""matching 機能の API ルータ集約（マッチング実行・検証・メタ情報・サンプル）。

バージョン非依存（prefix は /matching・/meta・/sample のみ）。API バージョンの
prefix（/api/v1 等）は backend/src/api/vN/router.py が include 時に付与する。

ステートレス API: リクエストに設定＋選好の全量を含め、
サーバーはリクエスト間で状態を持たない。CSRF・セッションは持たない。
"""

from __future__ import annotations

import os

from fastapi import APIRouter, status

from features.matching.application.usecases import (
    GetCaConstraintMeta,
    GetConstraintMeta,
    GetSample,
    RunMatching,
    ValidateInput,
)
from features.matching.presentation.schemas.matching import (
    CaConstraintMetaListResponse,
    CaConstraintMetaSchema,
    ConstraintTypeListResponse,
    ConstraintTypeMetaSchema,
    MatchingRequestSchema,
    MatchingRunResponse,
    ValidateResponse,
)
from features.matching.presentation.schemas.meta import AnalyticsConfigResponse
from shared.presentation.errors import ProblemDetail

router = APIRouter()

_matching_router = APIRouter(prefix="/matching", tags=["matching"])
_meta_router = APIRouter(prefix="/meta", tags=["meta"])
_sample_router = APIRouter(tags=["sample"])

_GA_MEASUREMENT_ID_ENV = "ENNX_GA_MEASUREMENT_ID"


@_matching_router.post(
    "/run",
    summary="マッチングを実行する",
    responses={status.HTTP_422_UNPROCESSABLE_CONTENT: {"model": ProblemDetail}},
)
def run_matching(request: MatchingRequestSchema) -> MatchingRunResponse:
    """設定＋選好を受け取り、配属・性質レポート・イベントログ・カットオフを返す。"""
    outcome = RunMatching().execute(request.to_dto())
    return MatchingRunResponse.from_dto(outcome)


@_matching_router.post(
    "/validate",
    summary="入力を事前検証する",
    responses={status.HTTP_422_UNPROCESSABLE_CONTENT: {"model": ProblemDetail}},
)
def validate_input(request: MatchingRequestSchema) -> ValidateResponse:
    """入力の妥当性のみを検証する（実行しない。ウィザードのステップ間検証用）。

    形式が正しい入力の検証結果（エラー一覧含む）は 200 で返す。
    リクエスト形式自体の誤り（型・上限超過）は 422（RFC 9457）となる。
    """
    outcome = ValidateInput().execute(request.to_dto())
    return ValidateResponse.from_dto(outcome)


@_meta_router.get("/constraint-types", summary="制約種別の一覧を取得する")
def get_constraint_types() -> ConstraintTypeListResponse:
    """設定ウィザードで選択可能な制約種別と対応アルゴリズムのメタ情報を返す。"""
    metas = GetConstraintMeta().execute()
    return ConstraintTypeListResponse(
        constraint_types=[ConstraintTypeMetaSchema.from_dto(meta) for meta in metas]
    )


@_meta_router.get("/ca-constraint-types", summary="CA 追加制約種別の一覧を取得する")
def get_ca_constraint_types() -> CaConstraintMetaListResponse:
    """CA（追加制約あり）で登録可能な制約種別と、パラメータのフィールド定義を返す。

    設定ウィザードの追加制約フォームは本メタ情報から動的に生成するため、
    制約レジストリ（features/matching/application/constraints.py）へ新しい
    制約種別を追加しても、既存の field_type を再利用する限りフロントエンドの
    改修は不要になる。
    """
    metas = GetCaConstraintMeta().execute()
    return CaConstraintMetaListResponse(
        ca_constraint_types=[CaConstraintMetaSchema.from_dto(meta) for meta in metas]
    )


@_meta_router.get("/analytics-config", summary="アクセス解析設定を取得する")
def get_analytics_config() -> AnalyticsConfigResponse:
    """GA4 測定 ID を返す。

    環境変数 `ENNX_GA_MEASUREMENT_ID` は本番の Render サービスにのみ設定する
    運用とし、開発環境・ローカルでは未設定のまま null を返して計測を無効化する。
    """
    measurement_id = os.environ.get(_GA_MEASUREMENT_ID_ENV) or None
    return AnalyticsConfigResponse(ga_measurement_id=measurement_id)


@_sample_router.get("/sample", summary="デモ用サンプル入力を取得する")
def get_sample() -> MatchingRequestSchema:
    """研修医マッチング風のサンプル入力（そのまま run に送信可能）を返す。"""
    return MatchingRequestSchema.from_dto(GetSample().execute())


router.include_router(_matching_router)
router.include_router(_meta_router)
router.include_router(_sample_router)
