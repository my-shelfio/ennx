"""FastAPI アプリファクトリ（合成ルート）。

Flask のアプリファクトリ（src/app/__init__.py: create_app）と同様、
テスト・本番でアプリ生成を共通化する。起動例:

    uv run uvicorn --app-dir backend/src "main:create_app" --factory

各 feature の組み立て（DI）は feature 内の infrastructure 層に委ね、
本モジュールはルータ登録・エラーハンドラ登録・ミドルウェア登録・
SPA マウントに限定する。

SPA 配信（単一サービス構成）: 環境変数 `ENNX_SPA_DIST` に Vite ビルド
成果物のディレクトリを指定すると、API に一致しないパスへ SPA を配信する。
未指定なら API のみで起動する（開発時は Vite dev サーバーが SPA を担う）。
"""

import os
from pathlib import Path

from fastapi import FastAPI

from api.v1.router import router as api_v1_router
from features.matching.presentation.errors import register_matching_error_handlers
from features.voting.presentation.errors import register_voting_error_handlers
from features.voting.presentation.router import get_voting_repository
from shared.presentation.errors import register_request_validation_handler
from shared.presentation.health import router as health_router
from shared.presentation.security import add_security_headers
from shared.presentation.spa import mount_spa

_SPA_DIST_ENV = "ENNX_SPA_DIST"


def create_app() -> FastAPI:
    """FastAPI アプリケーションを生成する。"""
    app = FastAPI(
        title="ennx API",
        description="社員と部署双方の希望を反映した配属マッチング API",
    )
    add_security_headers(app)
    app.include_router(health_router)
    app.include_router(api_v1_router)
    _wire_voting_repository(app)
    register_request_validation_handler(app)
    register_matching_error_handlers(app)
    register_voting_error_handlers(app)

    # SPA はルータ登録より後にマウントする（/api・/healthz を API に優先させる）。
    spa_dist = os.environ.get(_SPA_DIST_ENV)
    if spa_dist:
        mount_spa(app, Path(spa_dist))
    return app


def _wire_voting_repository(app: FastAPI) -> None:
    """投票リポジトリの DI 配線（合成ルート）。

    `DATABASE_URL` 設定時のみ infrastructure 実装（Neon PostgreSQL）を
    注入する。未設定時は依存を上書きせず、投票 API は 503 を返す
    （OpenAPI にはエンドポイントを常に含める）。
    """
    from features.voting.infrastructure import (
        SqlVotingRepository,
        create_voting_engine_from_env,
        init_voting_schema,
    )

    engine = create_voting_engine_from_env()
    if engine is None:
        return
    init_voting_schema(engine)
    repository = SqlVotingRepository(engine)
    app.dependency_overrides[get_voting_repository] = lambda: repository
