"""ヘルスチェックエンドポイント。

Render のヘルスチェック（render.yaml: healthCheckPath = /healthz）から利用する。
現行 Flask 実装（src/app）と同じパス・応答形式を維持し、切り替えを容易にする。
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/healthz")
def healthz() -> dict[str, str]:
    """稼働確認用。依存リソースを持たないため常に 200 を返す。"""
    return {"status": "ok"}
