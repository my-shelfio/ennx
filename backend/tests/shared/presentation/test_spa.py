"""SPA 配信とセキュリティヘッダのテスト。

単一サービス構成における以下を検証する:

- 全レスポンス（API・SPA）への共通セキュリティヘッダの付与
- StaticFiles による SPA 配信と SPA フォールバック（未知パス → index.html）
- API 契約パス（/api/*・/healthz）がフォールバックに巻き込まれないこと
- ビルド成果物が無い場合の即時失敗と、SPA 未設定（API のみ）の起動
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from main import create_app
from shared.presentation.security import SECURITY_HEADERS

_INDEX_HTML = "<!doctype html><html><body>ennx spa</body></html>"


@pytest.fixture
def dist_dir(tmp_path: Path) -> Path:
    """Vite ビルド成果物を模した最小の dist ディレクトリ。"""
    (tmp_path / "index.html").write_text(_INDEX_HTML, encoding="utf-8")
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "index-abc123.js").write_text("console.log('ennx');", encoding="utf-8")
    return tmp_path


@pytest.fixture
def spa_client(monkeypatch: pytest.MonkeyPatch, dist_dir: Path) -> TestClient:
    """SPA 配信を有効化したアプリのテストクライアント。"""
    monkeypatch.setenv("ENNX_SPA_DIST", str(dist_dir))
    return TestClient(create_app())


@pytest.fixture
def api_only_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """SPA 未設定（API のみ）のアプリのテストクライアント。"""
    monkeypatch.delenv("ENNX_SPA_DIST", raising=False)
    return TestClient(create_app())


class TestSecurityHeaders:
    """セキュリティヘッダの付与。"""

    def test_api_response_has_security_headers(self, api_only_client: TestClient) -> None:
        """API レスポンスに全セキュリティヘッダが付与される。"""
        response = api_only_client.get("/healthz")
        assert response.status_code == 200
        for name, value in SECURITY_HEADERS.items():
            assert response.headers.get(name) == value

    def test_spa_response_has_security_headers(self, spa_client: TestClient) -> None:
        """SPA 配信（index.html）にも同じセキュリティヘッダが付与される。"""
        response = spa_client.get("/")
        assert response.status_code == 200
        for name, value in SECURITY_HEADERS.items():
            assert response.headers.get(name) == value

    def test_error_response_has_security_headers(self, api_only_client: TestClient) -> None:
        """エラーレスポンス（404）にもセキュリティヘッダが付与される。"""
        response = api_only_client.get("/api/unknown")
        assert response.status_code == 404
        assert response.headers.get("X-Content-Type-Options") == "nosniff"


class TestSPAServing:
    """SPA 配信と SPA フォールバック。"""

    def test_root_serves_index_html(self, spa_client: TestClient) -> None:
        """`/` で index.html が配信される。"""
        response = spa_client.get("/")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/html")
        assert response.text == _INDEX_HTML

    def test_static_asset_is_served(self, spa_client: TestClient) -> None:
        """dist 配下の静的ファイルがそのまま配信される。"""
        response = spa_client.get("/assets/index-abc123.js")
        assert response.status_code == 200
        assert "console.log('ennx');" in response.text

    def test_unknown_path_falls_back_to_index_html(self, spa_client: TestClient) -> None:
        """未知パス（クライアントサイドルート）は index.html にフォールバックする。"""
        response = spa_client.get("/wizard/step-1")
        assert response.status_code == 200
        assert response.text == _INDEX_HTML

    def test_api_path_does_not_fall_back(self, spa_client: TestClient) -> None:
        """未知の API パスは 404 のまま（index.html を返さない）。"""
        response = spa_client.get("/api/unknown")
        assert response.status_code == 404
        assert response.text != _INDEX_HTML

    def test_api_routes_take_precedence(self, spa_client: TestClient) -> None:
        """API ルート（/healthz）はマウントより優先される。"""
        response = spa_client.get("/healthz")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestAppFactory:
    """アプリファクトリの SPA 設定分岐。"""

    def test_missing_dist_raises(self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        """dist に index.html が無ければ起動時に即時失敗する。"""
        monkeypatch.setenv("ENNX_SPA_DIST", str(tmp_path))
        with pytest.raises(FileNotFoundError):
            create_app()

    def test_without_spa_env_api_only(self, api_only_client: TestClient) -> None:
        """ENNX_SPA_DIST 未設定なら SPA は配信せず API のみで動作する。"""
        response = api_only_client.get("/")
        assert response.status_code == 404
