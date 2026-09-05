"""API v1 集約ルータ。

feature ごとの presentation 層ルータ（バージョン非依存）を `/api/v1` 配下に
prefix 付きで集約する。v2 を追加する場合は、変更のある feature にのみ
`presentation/router_v2.py`（必要ならスキーマも分離）を用意して
`api/v2/router.py` を新設し、変更のない feature は本ファイルと同じ v1 ルータを
そのまま include すればよい（全 feature への v2 追加は不要）。
"""

from __future__ import annotations

from fastapi import APIRouter

from features.assignment.presentation.router import router as assignment_router
from features.matching.presentation.router import router as matching_router
from features.voting.presentation.router import router as voting_router

router = APIRouter(prefix="/api/v1")
router.include_router(matching_router)
router.include_router(assignment_router)
router.include_router(voting_router)
