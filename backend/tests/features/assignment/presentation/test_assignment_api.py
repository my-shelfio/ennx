"""assignment API のテスト（ルーティング・スキーマ変換・エラー応答）。"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from main import create_app

VALID_BODY: dict[str, Any] = {
    "constraint_type": "capacity_only",
    "capacities": [1, 1],
    "agent_prefs": [[1, 2], [1, 2], [2, 1], [2, 1]],
}


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(create_app())


def test_run_returns_expected_assignment_lottery_and_report(client: TestClient) -> None:
    response = client.post("/api/v1/assignment/run", json=VALID_BODY)

    assert response.status_code == 200
    body = response.json()
    assert body["mechanism"] == "ps"
    assert body["expected_assignment"][0] == ["1/2", "0", "1/2"]
    assert body["lottery"]
    assert {item["label"] for item in body["report"]} >= {"順序効率性", "無羨望性", "耐戦略性"}


def test_run_rejects_unknown_constraint_type_with_problem_detail(client: TestClient) -> None:
    response = client.post(
        "/api/v1/assignment/run", json={**VALID_BODY, "constraint_type": "unknown"}
    )

    assert response.status_code == 422
    problem = response.json()
    assert problem["title"] == "入力が不正です"
    assert problem["errors"][0]["field"] == "constraint_type"


def test_validate_returns_errors_without_executing(client: TestClient) -> None:
    response = client.post("/api/v1/assignment/validate", json={**VALID_BODY, "agent_prefs": [[9]]})

    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is False
    assert body["errors"]


def test_sample_can_be_posted_to_run(client: TestClient) -> None:
    sample = client.get("/api/v1/assignment/sample").json()

    response = client.post("/api/v1/assignment/run", json=sample)

    assert response.status_code == 200
    assert response.json()["lottery"]


def test_meta_endpoints_expose_constraint_definitions(client: TestClient) -> None:
    constraint_types = client.get("/api/v1/meta/assignment-constraint-types").json()
    upper_constraints = client.get("/api/v1/meta/assignment-upper-constraint-types").json()

    assert [c["key"] for c in constraint_types["constraint_types"]] == ["capacity_only", "general"]
    assert constraint_types["constraint_types"][0]["mechanism"]["not_guaranteed"]
    keys = [c["key"] for c in upper_constraints["upper_constraint_types"]]
    assert keys == ["ng_pair", "group_quota"]


def test_request_body_rejects_unknown_fields(client: TestClient) -> None:
    response = client.post(
        "/api/v1/assignment/run", json={**VALID_BODY, "receiver_prefs": [[1], [2]]}
    )

    assert response.status_code == 422


def test_run_returns_drawn_assignment_and_seed(client: TestClient) -> None:
    response = client.post("/api/v1/assignment/run", json={**VALID_BODY, "seed": 99})

    assert response.status_code == 200
    body = response.json()
    assert body["seed"] == 99
    assert len(body["drawn_assignment"]) == 4
    assert body["lottery_complete"] is True


def test_same_seed_reproduces_the_same_draw(client: TestClient) -> None:
    body = {**VALID_BODY, "seed": 2026}

    first = client.post("/api/v1/assignment/run", json=body).json()
    second = client.post("/api/v1/assignment/run", json=body).json()

    assert first["drawn_assignment"] == second["drawn_assignment"]


def test_run_rejects_input_over_the_size_limit(client: TestClient) -> None:
    response = client.post(
        "/api/v1/assignment/run",
        json={**VALID_BODY, "agent_prefs": [[1, 2] for _ in range(25)]},
    )

    assert response.status_code == 422
