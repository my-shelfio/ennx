"""SPA（Vite ビルド成果物）の配信（単一サービス構成）。

単一サービス構成で FastAPI が API と SPA の両方を配信する。Docker イメージに
コピーされた `frontend/dist` を StaticFiles でマウントし、静的ファイルに
一致しないパスには index.html を返す（SPA フォールバック。React Router の
クライアントサイドルーティングをリロード・直リンクでも成立させる）。

`/api/` 配下と `/healthz` は API 契約のパスであり、フォールバック対象外
（未知の API パスに index.html を返すと、クライアントが HTML を JSON として
解釈してしまうため 404 のままにする）。
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope


def _is_reserved_path(path: str) -> bool:
    """API 契約の予約パス（マウント内の相対パス表記）かを判定する。"""
    return path.startswith("api/") or path == "healthz"


class SPAStaticFiles(StaticFiles):
    """404 のとき index.html にフォールバックする StaticFiles。"""

    async def get_response(self, path: str, scope: Scope) -> Response:
        """静的ファイルを返し、見つからなければ index.html を返す。"""
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code != 404 or _is_reserved_path(path):
                raise
            return await super().get_response("index.html", scope)


def mount_spa(app: FastAPI, dist_dir: Path) -> None:
    """SPA のビルド成果物をルート（`/`）にマウントする。

    ルータ登録より後に呼ぶこと（FastAPI はルータを先に照合するため、
    `/api/*`・`/healthz` は API が優先され、残りが SPA に落ちる）。

    Args:
        dist_dir: `vite build` の出力ディレクトリ（index.html を含むこと）。

    Raises:
        FileNotFoundError: dist_dir または index.html が存在しない場合。
            設定ミスのまま API のみで起動する事故を防ぐため即時失敗させる。
    """
    if not (dist_dir / "index.html").is_file():
        raise FileNotFoundError(f"SPA ビルド成果物が見つかりません: {dist_dir}/index.html")
    app.mount("/", SPAStaticFiles(directory=dist_dir, html=True), name="spa")
