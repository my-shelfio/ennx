"""アクセス解析設定の API（どの feature にも属さない設定配信のため shared に置く）。"""

from __future__ import annotations

import os

from fastapi import APIRouter
from pydantic import BaseModel, Field

_GA_MEASUREMENT_ID_ENV = "ENNX_GA_MEASUREMENT_ID"

router = APIRouter(prefix="/meta", tags=["meta"])


class AnalyticsConfigResponse(BaseModel):
    """GET /api/v1/meta/analytics-config のレスポンス。

    GA4 測定 ID は公開値（秘匿不要）だが、本番環境でのみ計測を有効化する
    決定に従い、環境変数 `ENNX_GA_MEASUREMENT_ID` が設定されて
    いる場合のみ値を返す。フロントエンドは null のとき計測スクリプトを読み込まない。
    """

    ga_measurement_id: str | None = Field(
        description="GA4 測定ID（本番環境のみ設定。未設定時は null で計測を無効化する）"
    )


@router.get("/analytics-config", summary="アクセス解析設定を取得する")
def get_analytics_config() -> AnalyticsConfigResponse:
    """GA4 測定 ID を返す。

    環境変数 `ENNX_GA_MEASUREMENT_ID` は本番の Render サービスにのみ設定する
    運用とし、開発環境・ローカルでは未設定のまま null を返して計測を無効化する。
    """
    measurement_id = os.environ.get(_GA_MEASUREMENT_ID_ENV) or None
    return AnalyticsConfigResponse(ga_measurement_id=measurement_id)
