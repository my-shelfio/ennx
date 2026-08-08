# 本番用イメージ: uvicorn で FastAPI アプリ（API + SPA）を単一サービスとして起動する
# multi-stage 構成:
#   1. backend: Python 依存関係とアプリ本体をインストールし、OpenAPI スキーマを書き出す
#   2. spa-build: Node で API 型（schema.d.ts）を生成し、frontend/ をビルドする
#      （openapi.json / schema.d.ts はコミットせず都度再生成する運用のため、
#        イメージ内で生成する。Render はクリーンな git clone をビルドコンテキストとする）
#   3. 最終: backend へ Vite の成果物（dist）をコピーし、StaticFiles で SPA を配信する
# 将来の Cloud Run 移行を見据え、$PORT を尊重する標準構成とする。

# --- ステージ 1: バックエンド（Python） ---
FROM python:3.13-slim AS backend

# uv を公式配布イメージからバイナリのみ取得する（バージョン固定）。
COPY --from=ghcr.io/astral-sh/uv:0.11.19 /uv /uvx /bin/

# uv の挙動: バイトコード事前コンパイル（起動高速化）、コピーリンク、Python の自動DL無効。
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0

WORKDIR /app

# 【1段目】依存関係のみを先にインストールし、レイヤキャッシュを効かせる。
# ソースコード変更では pyproject.toml / uv.lock が変わらない限りこのレイヤは再利用される。
# uv.lock と pyproject.toml が食い違う場合は --frozen によりここで失敗する。
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project

# 【2段目】ソースコードを配置し、プロジェクト本体をインストールする。
# （pyproject.toml のパッケージビルドに README.md・backend/src が必要。
COPY README.md ./
COPY backend ./backend
RUN uv sync --frozen --no-dev

# フロントエンドの型生成の入力となる OpenAPI スキーマを書き出す。
RUN .venv/bin/python backend/scripts/export_openapi.py /app/openapi.json

# --- ステージ 2: SPA ビルド（Node） ---
FROM node:22-slim AS spa-build

WORKDIR /build

# 依存関係のみを先にインストールし、レイヤキャッシュを効かせる。
# package-lock.json と食い違う場合は npm ci がここで失敗する。
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# ソース一式をコピーし、API 型を backend の OpenAPI スキーマから生成してビルドする。
# node_modules / dist / 生成物（openapi.json, schema.d.ts）は .dockerignore で除外済み。
COPY frontend/ ./
COPY --from=backend /app/openapi.json ./openapi.json
RUN npm run gen:api-types && npm run build

# --- ステージ 3: ランタイム ---
FROM backend

# SPA のビルド成果物を配置し、配信パスを環境変数で指定する（main.py 参照）。
COPY --from=spa-build /build/dist ./frontend/dist
ENV ENNX_SPA_DIST=/app/frontend/dist

# 非 root ユーザーで実行する（セキュリティ最低限対応）。
RUN useradd --create-home --uid 10001 appuser
USER appuser

# Cloud Run / Render は $PORT を注入する。既定は 8080。
ENV PORT=8080
EXPOSE 8080

# 仮想環境の uvicorn を exec で直接起動（PID 1 としてシグナルを受け、起動時の uv 解決を避ける）。
# main モジュールは uv sync でインストール済み（pyproject.toml の force-include）。
# FastAPI アプリはセッションを持たないため SECRET_KEY は不要。
CMD ["sh", "-c", "exec .venv/bin/uvicorn main:create_app --factory --host 0.0.0.0 --port ${PORT:-8080} --workers 2 --timeout-graceful-shutdown 30 --access-log"]
