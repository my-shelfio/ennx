"""セキュリティヘッダの付与。

API レスポンス・SPA 配信の全レスポンスに共通のセキュリティヘッダを付与する。

- CSP は Vite ビルドの SPA を前提に最小権限で構成する。スクリプトは自己
  オリジンのバンドルと GA4（`googletagmanager.com`）のみ許可し、
  インラインスクリプトは禁止する。style 属性によるインラインスタイル
  （React / motion が使用）のみ `unsafe-inline` を許可する
- API・SPA とも同一オリジンで完結するため connect-src は 'self' を基本とし、
  GA4 の計測送信先（`google-analytics.com` 系ドメイン）のみ追加で許可する。
  GA4 は `ENNX_GA_MEASUREMENT_ID` 環境変数が設定された本番環境でのみ読み込まれる
  （`/api/v1/meta/analytics-config` が null を返す環境では JS 側で読み込み自体を行わない）
- HSTS は Render が常時 TLS で配信するため付与する（HTTP 提供は行わない）
- /docs（Swagger UI）・/redoc は緪和した CSP を適用する（他のヘッダは共通のまま）
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

# GA4（Google Analytics 4）用のドメイン。
# script-src: gtag.js の読み込み元。connect-src: 計測イベントの送信先
# （リジョン別エンドポイント region1.google-analytics.com を含む）。
_GA_SCRIPT_SRC = "https://www.googletagmanager.com"
_GA_CONNECT_SRC = "https://www.google-analytics.com https://*.google-analytics.com"

_CSP = "; ".join(
    (
        "default-src 'self'",
        f"script-src 'self' {_GA_SCRIPT_SRC}",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        f"connect-src 'self' {_GA_CONNECT_SRC}",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    )
)

# FastAPI 標準の /docs（Swagger UI）は CDN（cdn.jsdelivr.net）から JS/CSS を
# 読み込み、初期化用のインラインスクリプトを埋め込む実装になっている。
# 既定の CSP（script-src 'self' のみ）ではこれらがブロックされ画面が
# 描画されないため、/docs レスポンスに限り緪和した CSP を適用する。
_SWAGGER_UI_CSP = "; ".join(
    (
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "img-src 'self' data: https://fastapi.tiangolo.com",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    )
)

_PATH_CSP_OVERRIDES: dict[str, str] = {
    "/docs": _SWAGGER_UI_CSP,  # Swagger UI
}

SECURITY_HEADERS: dict[str, str] = {
    "Content-Security-Policy": _CSP,
    # MIME スニッフィングの禁止（Content-Type を信頼させる）。
    "X-Content-Type-Options": "nosniff",
    # 旧ブラウザ向けのクリックジャッキング対策（CSP frame-ancestors の後方互換）。
    "X-Frame-Options": "DENY",
    # 外部オリジンへはオリジンのみ送信（既定値の明示）。
    "Referrer-Policy": "strict-origin-when-cross-origin",
    # 使用しない強力な機能を明示的に無効化する。
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    # 1 年間 HTTPS を強制（Render は常時 TLS。サブドメイン運用はないため対象外）。
    "Strict-Transport-Security": "max-age=31536000",
}


def add_security_headers(app: FastAPI) -> None:
    """全レスポンスにセキュリティヘッダを付与するミドルウェアを登録する。"""

    @app.middleware("http")
    async def security_headers_middleware(
        request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """レスポンスに共通セキュリティヘッダを追加する。

        /docs・/redoc は CDN 依存の標準 HTML を返すため、CSP のみ
        パス別に緪和したものへ差し替える（他のヘッダは共通のまま）。
        """
        response = await call_next(request)
        for name, value in SECURITY_HEADERS.items():
            response.headers[name] = value
        csp_override = _PATH_CSP_OVERRIDES.get(request.url.path)
        if csp_override:
            response.headers["Content-Security-Policy"] = csp_override
        return response
