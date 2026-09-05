"""OpenAPI スキーマ生成のテスト。"""

from __future__ import annotations

from fastapi.testclient import TestClient

from main import create_app

EXPECTED_PATHS = (
    "/healthz",
    "/api/v1/matching/run",
    "/api/v1/matching/validate",
    "/api/v1/meta/constraint-types",
    "/api/v1/meta/ca-constraint-types",
    "/api/v1/meta/analytics-config",
    "/api/v1/sample",
    "/api/v1/assignment/run",
    "/api/v1/assignment/validate",
    "/api/v1/assignment/sample",
    "/api/v1/meta/assignment-constraint-types",
    "/api/v1/meta/assignment-upper-constraint-types",
    "/api/v1/voting/sessions",
    "/api/v1/voting/p/{participant_token}",
    "/api/v1/voting/p/{participant_token}/ballots",
    "/api/v1/voting/a/{admin_token}",
    "/api/v1/voting/a/{admin_token}/close",
    "/api/v1/voting/a/{admin_token}/results",
    "/api/v1/voting/cleanup",
)


def test_openapi_schema_contains_all_endpoints() -> None:
    """OpenAPI スキーマが生成され、全エンドポイントを含む（M7 の型生成の源泉）。

    投票 API（`/api/v1/voting/*`）は `DATABASE_URL` 未設定でもルータ自体は常に
    登録される（main.py の `_wire_voting_repository` docstring 参照）ため、
    DI 配線の有無に関わらず OpenAPI スキーマに含まれる。
    """
    client = TestClient(create_app())

    response = client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    for path in EXPECTED_PATHS:
        assert path in schema["paths"], f"OpenAPI に {path} がありません"


def test_run_endpoint_documents_problem_detail() -> None:
    """run の 422 レスポンスが RFC 9457（ProblemDetail）として文書化されている。"""
    client = TestClient(create_app())

    schema = client.get("/openapi.json").json()

    for path in ("/api/v1/matching/run", "/api/v1/assignment/run"):
        responses = schema["paths"][path]["post"]["responses"]
        assert "422" in responses
