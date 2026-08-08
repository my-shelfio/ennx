"""投票 API のテスト（TestClient + SQLite リポジトリを DI で注入）。"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool

from features.voting.infrastructure import SqlVotingRepository, init_voting_schema
from features.voting.presentation.router import get_voting_repository
from main import create_app


@pytest.fixture()
def client() -> Iterator[TestClient]:
    engine = sa.create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    init_voting_schema(engine)
    repository = SqlVotingRepository(engine)
    app = create_app()
    app.dependency_overrides[get_voting_repository] = lambda: repository
    with TestClient(app) as test_client:
        yield test_client


def _create_session(client: TestClient, method: str = "ranking") -> dict[str, str]:
    response = client.post(
        "/api/v1/voting/sessions",
        json={"title": "投票テスト", "options": ["案A", "案B", "案C"], "method": method},
    )
    assert response.status_code == 201
    body: dict[str, str] = response.json()
    return body


def test_create_returns_tokens_and_expiry(client: TestClient) -> None:
    body = _create_session(client)
    assert body["participant_token"] != body["admin_token"]
    assert body["deadline"] == body["expires_at"]


def test_full_voting_flow(client: TestClient) -> None:
    tokens = _create_session(client)
    p, a = tokens["participant_token"], tokens["admin_token"]

    view = client.get(f"/api/v1/voting/p/{p}")
    assert view.status_code == 200
    assert view.json()["is_closed"] is False

    admin_before = client.get(f"/api/v1/voting/a/{a}")
    assert admin_before.status_code == 200
    assert admin_before.json()["voters"] == []

    for key, ranking in (("v1", [0, 1, 2]), ("v2", [1, 0, 2]), ("v3", [1, 2, 0])):
        response = client.post(
            f"/api/v1/voting/p/{p}/ballots", json={"voter_name": key, "ranking": ranking}
        )
        assert response.status_code == 204

    admin_after = client.get(f"/api/v1/voting/a/{a}")
    assert set(admin_after.json()["voters"]) == {"v1", "v2", "v3"}

    # 締切前の結果取得は 409。
    assert client.get(f"/api/v1/voting/a/{a}/results").status_code == 409

    assert client.post(f"/api/v1/voting/a/{a}/close").status_code == 204
    results = client.get(f"/api/v1/voting/a/{a}/results")
    assert results.status_code == 200
    body = results.json()
    assert body["ballot_count"] == 3
    assert body["primary"]["rule"] == "borda"
    assert len(body["comparison"]) == 3
    assert any(item["label"] == "コンドルセ勝者" for item in body["report"])
    assert set(body["voters"]) == {"v1", "v2", "v3"}

    # 締切後の投票は 409。
    late = client.post(
        f"/api/v1/voting/p/{p}/ballots", json={"voter_name": "v9", "ranking": [0, 1, 2]}
    )
    assert late.status_code == 409


def test_unknown_token_returns_404(client: TestClient) -> None:
    assert client.get("/api/v1/voting/p/unknown").status_code == 404
    assert client.get("/api/v1/voting/a/unknown").status_code == 404


def test_invalid_ballot_returns_422(client: TestClient) -> None:
    tokens = _create_session(client)
    response = client.post(
        f"/api/v1/voting/p/{tokens['participant_token']}/ballots",
        json={"voter_name": "v1", "ranking": [0, 0, 1]},
    )
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")


def test_empty_nickname_returns_422(client: TestClient) -> None:
    tokens = _create_session(client)
    response = client.post(
        f"/api/v1/voting/p/{tokens['participant_token']}/ballots",
        json={"voter_name": "", "ranking": [0, 1, 2]},
    )
    assert response.status_code == 422


def test_missing_nickname_returns_422(client: TestClient) -> None:
    tokens = _create_session(client)
    response = client.post(
        f"/api/v1/voting/p/{tokens['participant_token']}/ballots",
        json={"ranking": [0, 1, 2]},
    )
    assert response.status_code == 422


def test_invalid_create_returns_422_with_field_errors(client: TestClient) -> None:
    response = client.post(
        "/api/v1/voting/sessions",
        json={"title": "", "options": ["案A"], "method": "unknown"},
    )
    assert response.status_code == 422
    fields = {e["field"] for e in response.json()["errors"]}
    assert {"title", "options", "method"} <= fields


def test_delete_session(client: TestClient) -> None:
    tokens = _create_session(client)
    assert client.delete(f"/api/v1/voting/a/{tokens['admin_token']}").status_code == 204
    assert client.get(f"/api/v1/voting/p/{tokens['participant_token']}").status_code == 404


def test_cleanup_requires_key(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    # キー未設定 → 404（存在秘匿）。
    monkeypatch.delenv("ENNX_CLEANUP_KEY", raising=False)
    assert client.post("/api/v1/voting/cleanup").status_code == 404
    # キー不一致 → 404。
    monkeypatch.setenv("ENNX_CLEANUP_KEY", "secret-key")
    response = client.post("/api/v1/voting/cleanup", headers={"X-Cleanup-Key": "wrong"})
    assert response.status_code == 404
    # キー一致 → 200。
    response = client.post("/api/v1/voting/cleanup", headers={"X-Cleanup-Key": "secret-key"})
    assert response.status_code == 200
    assert response.json() == {"deleted": 0}


def test_voting_unavailable_without_repository() -> None:
    """DATABASE_URL 未設定（DI 未配線）では投票 API が 503 を返す。"""
    app = create_app()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/voting/sessions",
            json={"title": "t", "options": ["a", "b"], "method": "ranking"},
        )
        assert response.status_code == 503
