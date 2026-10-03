"""結果共有 API のテスト（TestClient + SQLite リポジトリを DI で注入）。"""

from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import datetime, timedelta
from typing import Any

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool

from features.matching.presentation.schemas.matching import MatchingRequestSchema
from features.result_share.infrastructure import (
    SqlResultShareRepository,
    init_result_share_schema,
)
from features.result_share.infrastructure.db import result_shares
from features.result_share.presentation.router import get_result_share_repository
from features.result_share.presentation.schemas import SharedMatchingInputSchema
from main import create_app


@pytest.fixture()
def engine() -> Engine:
    engine = sa.create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    init_result_share_schema(engine)
    return engine


@pytest.fixture()
def client(engine: Engine) -> Iterator[TestClient]:
    repository = SqlResultShareRepository(engine)
    app = create_app()
    app.dependency_overrides[get_result_share_repository] = lambda: repository
    with TestClient(app) as test_client:
        yield test_client


def _sample_input(client: TestClient, key: str | None = None) -> dict[str, Any]:
    response = client.get("/api/v1/sample", params={"key": key} if key else None)
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    return body


def _create_share(
    client: TestClient, matching_input: dict[str, Any], retention_days: int | None = None
) -> dict[str, str]:
    payload: dict[str, Any] = {"input": matching_input}
    if retention_days is not None:
        payload["retention_days"] = retention_days
    response = client.post("/api/v1/result-share/snapshots", json=payload)
    assert response.status_code == 201, response.text
    body: dict[str, str] = response.json()
    return body


def test_shared_input_reproduces_matching_result_for_all_samples(
    client: TestClient, engine: Engine
) -> None:
    """保存されるのは入力のみで、閲覧時に実行 API で再計算すると発行時と同じ結果になる。"""
    keys = [s["key"] for s in client.get("/api/v1/samples").json()["samples"]]
    assert keys
    for key in keys:
        matching_input = _sample_input(client, key)
        created = _create_share(client, matching_input)

        with engine.connect() as conn:
            stored = conn.execute(
                sa.select(result_shares.c.snapshot).where(
                    result_shares.c.view_token == created["view_token"]
                )
            ).scalar_one()
        assert set(stored) == set(MatchingRequestSchema.model_fields), "入力以外を保存しない"

        shared = client.get(f"/api/v1/result-share/v/{created['view_token']}")
        assert shared.status_code == 200
        assert shared.json()["expires_at"] == created["expires_at"]
        original = client.post("/api/v1/matching/run", json=matching_input)
        recomputed = client.post("/api/v1/matching/run", json=shared.json()["input"])
        assert recomputed.status_code == 200
        assert recomputed.json() == original.json(), key


def test_default_retention_is_seven_days(client: TestClient) -> None:
    created = _create_share(client, _sample_input(client))
    issued = datetime.fromisoformat(created["created_at"])
    expires = datetime.fromisoformat(created["expires_at"])
    assert expires - issued == timedelta(days=7)


@pytest.mark.parametrize("retention_days", [0, 31])
def test_retention_out_of_range_returns_422(client: TestClient, retention_days: int) -> None:
    response = client.post(
        "/api/v1/result-share/snapshots",
        json={"input": _sample_input(client), "retention_days": retention_days},
    )
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")
    assert [e["field"] for e in response.json()["errors"]] == ["retention_days"]


def test_malformed_input_returns_422(client: TestClient) -> None:
    matching_input = _sample_input(client)
    for broken in (
        {**matching_input, "unknown_field": 1},
        {**matching_input, "capacities": "1,2"},
        {key: value for key, value in matching_input.items() if key != "proposer_prefs"},
    ):
        response = client.post("/api/v1/result-share/snapshots", json={"input": broken})
        assert response.status_code == 422


def test_too_large_input_returns_413(client: TestClient) -> None:
    matching_input = _sample_input(client)
    names = ["x" * (256 * 1024) for _ in matching_input["proposer_prefs"]]
    response = client.post(
        "/api/v1/result-share/snapshots",
        json={"input": {**matching_input, "employee_names": names}},
    )
    assert response.status_code == 413


def test_delete_makes_view_url_unavailable(client: TestClient) -> None:
    created = _create_share(client, _sample_input(client), retention_days=30)
    view_url = f"/api/v1/result-share/v/{created['view_token']}"
    assert client.get(view_url).status_code == 200
    # 閲覧用トークンでは削除できない。
    assert client.delete(f"/api/v1/result-share/d/{created['view_token']}").status_code == 404
    assert client.delete(f"/api/v1/result-share/d/{created['delete_token']}").status_code == 204
    assert client.get(view_url).status_code == 404


def _expire(engine: Engine, view_token: str) -> None:
    """指定した共有データの有効期限を過去に書き換える（期限経過の再現）。"""
    with engine.begin() as conn:
        conn.execute(
            sa.update(result_shares)
            .where(result_shares.c.view_token == view_token)
            .values(expires_at="2000-01-01T00:00:00.000000+00:00")
        )


def test_expired_share_returns_404(client: TestClient, engine: Engine) -> None:
    created = _create_share(client, _sample_input(client))
    _expire(engine, created["view_token"])
    assert client.get(f"/api/v1/result-share/v/{created['view_token']}").status_code == 404


def test_cleanup_deletes_expired_shares(
    client: TestClient, engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """無アクセスのまま期限を過ぎた共有データは、日次の一括削除で削除される。"""
    expired = _create_share(client, _sample_input(client))
    alive = _create_share(client, _sample_input(client))
    _expire(engine, expired["view_token"])
    monkeypatch.setenv("ENNX_CLEANUP_KEY", "secret-key")
    response = client.post("/api/v1/result-share/cleanup", headers={"X-Cleanup-Key": "secret-key"})
    assert response.status_code == 200
    assert response.json() == {"deleted": 1}
    with engine.connect() as conn:
        remaining = conn.execute(sa.select(result_shares.c.view_token)).scalars().all()
    assert remaining == [alive["view_token"]]


def test_cleanup_requires_key(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENNX_CLEANUP_KEY", raising=False)
    assert client.post("/api/v1/result-share/cleanup").status_code == 404
    monkeypatch.setenv("ENNX_CLEANUP_KEY", "secret-key")
    response = client.post("/api/v1/result-share/cleanup", headers={"X-Cleanup-Key": "wrong"})
    assert response.status_code == 404


def test_result_share_unavailable_without_repository() -> None:
    """DATABASE_URL 未設定（DI 未配線）では結果共有 API が 503 を返す。"""
    with TestClient(create_app()) as client:
        response = client.post(
            "/api/v1/result-share/snapshots", json={"input": _sample_input(client)}
        )
        assert response.status_code == 503
        assert client.get("/api/v1/result-share/v/any").status_code == 503


def _strip_docs(value: object) -> object:
    """JSON Schema から説明用のキー（title / description）を除き、構造のみを残す。"""
    if isinstance(value, dict):
        return {k: _strip_docs(v) for k, v in value.items() if k not in ("title", "description")}
    if isinstance(value, list):
        return [_strip_docs(v) for v in value]
    return value


def test_shared_input_schema_mirrors_matching_request_schema() -> None:
    """共有する入力の形式・上限は、マッチング実行 API のリクエストボディと一致する。

    結果共有はマッチング機能に依存せず同じ形のスキーマを持つため、どちらかだけを
    変更すると、発行が 422 になる・閲覧時の再計算に失敗するといった食い違いが生じる。
    """
    shared = json.dumps(_strip_docs(SharedMatchingInputSchema.model_json_schema()))
    matching = json.dumps(_strip_docs(MatchingRequestSchema.model_json_schema()))
    assert shared.replace("SharedConstraintEntrySchema", "ConstraintEntrySchema") == matching
