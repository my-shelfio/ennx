"""メタ情報 API の Pydantic スキーマ（アクセス解析設定など、単一機能に紐づかないもの）。"""

from __future__ import annotations

from pydantic import BaseModel, Field


class AnalyticsConfigResponse(BaseModel):
    """GET /api/v1/meta/analytics-config のレスポンス。

    GA4 測定 ID は公開値（秘匿不要）だが、本番環境でのみ計測を有効化する
    決定に従い、環境変数 `ENNX_GA_MEASUREMENT_ID` が設定されて
    いる場合のみ値を返す。フロントエンドは null のとき計測スクリプトを読み込まない。
    """

    ga_measurement_id: str | None = Field(
        description="GA4 測定ID（本番環境のみ設定。未設定時は null で計測を無効化する）"
    )
