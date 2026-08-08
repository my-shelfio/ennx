"""イベントログの契約テスト。

docs/event-schema.json（API 契約）に対して、`POST /api/v1/matching/run` の
レスポンス `events[]` が 3 アルゴリズム（DA / FDA / CA）すべてで適合する
ことを検証する。あわせて、レスポンスのイベントログだけから最終結果を
再構成し、配属結果と完全一致することを API 経由で検証する。

検証は標準ライブラリのみで行う（本スキーマが使用する JSON Schema 語彙の
サブセットを _validate が実装する）。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from features.matching.domain.events import EventType, MatchingEvent, reconstruct_matching
from main import create_app

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "docs" / "event-schema.json"

# 各アルゴリズム固有のイベントを含む最小入力。
# DA: 定員 1 に 2 名が競合 → propose / tentative_accept / reject
# FDA: 目標定員超過 → waitlist / promote（待機リストフェーズ）
# CA: NG ペア制約超過 → cutoff_raise
REQUEST_BODIES: dict[str, dict[str, Any]] = {
    "da": {
        "constraint_type": "capacity_only",
        "capacities": [1, 1],
        "proposer_prefs": [[1, 2], [1, 2]],
        "receiver_prefs": [[1, 2], [1, 2]],
    },
    "fda": {
        "constraint_type": "regional_cap",
        "capacities": [1, 1],
        "proposer_prefs": [[1, 2], [1, 2]],
        "receiver_prefs": [[1, 2], [1, 2]],
        "max_caps": [2, 2],
        "regions": [0, 0],
        "regional_caps": [2],
    },
    "ca": {
        "constraint_type": "general",
        "capacities": [2, 2],
        "proposer_prefs": [[1, 2], [1, 2]],
        "receiver_prefs": [[1, 2], [1, 2]],
        "constraints": [{"type": "ng_pair", "params": {"pairs": [[0, 1]]}}],
    },
}

ALGORITHMS = tuple(REQUEST_BODIES.keys())


def _check_type(value: object, type_name: str) -> bool:
    """JSON Schema の型名 1 つに対する適合判定。"""
    if type_name == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if type_name == "string":
        return isinstance(value, str)
    if type_name == "null":
        return value is None
    if type_name == "object":
        return isinstance(value, dict)
    raise NotImplementedError(f"未対応の型です: {type_name}")


def _validate(instance: object, schema: dict[str, Any], path: str = "$") -> list[str]:
    """docs/event-schema.json が使用する JSON Schema 語彙のサブセットで検証する。

    対応キーワード: type / enum / const / minimum / required / properties /
    additionalProperties(false) / allOf / if-then-else。
    未対応のキーワードを検出した場合はテストを失敗させる（NotImplementedError）。

    Returns:
        違反メッセージの一覧（適合時は空リスト）。
    """
    known = {
        "$schema",
        "$id",
        "title",
        "description",
        "type",
        "enum",
        "const",
        "minimum",
        "required",
        "properties",
        "additionalProperties",
        "allOf",
        "if",
        "then",
        "else",
    }
    unknown = set(schema) - known
    if unknown:
        raise NotImplementedError(f"未対応の JSON Schema キーワードです: {sorted(unknown)}")

    errors: list[str] = []
    if "type" in schema:
        types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(_check_type(instance, t) for t in types):
            errors.append(f"{path}: 型が {types} に適合しません: {instance!r}")
            return errors
    if "enum" in schema and instance not in schema["enum"]:
        errors.append(f"{path}: {instance!r} は enum {schema['enum']} に含まれません")
    if "const" in schema and instance != schema["const"]:
        errors.append(f"{path}: {instance!r} は const {schema['const']!r} と一致しません")
    if "minimum" in schema and isinstance(instance, int) and not isinstance(instance, bool):
        if instance < schema["minimum"]:
            errors.append(f"{path}: {instance} が最小値 {schema['minimum']} を下回ります")
    if isinstance(instance, dict):
        for name in schema.get("required", []):
            if name not in instance:
                errors.append(f"{path}: 必須プロパティ {name} がありません")
        properties = schema.get("properties", {})
        for name, subschema in properties.items():
            if name in instance:
                errors.extend(_validate(instance[name], subschema, f"{path}.{name}"))
        if schema.get("additionalProperties") is False:
            extras = set(instance) - set(properties)
            if extras:
                errors.append(f"{path}: 未定義のプロパティがあります: {sorted(extras)}")
    for i, subschema in enumerate(schema.get("allOf", [])):
        errors.extend(_validate(instance, subschema, f"{path}(allOf[{i}])"))
    if "if" in schema:
        if not _validate(instance, schema["if"], path):
            if "then" in schema:
                errors.extend(_validate(instance, schema["then"], f"{path}(then)"))
        elif "else" in schema:
            errors.extend(_validate(instance, schema["else"], f"{path}(else)"))
    return errors


@pytest.fixture(scope="module")
def schema() -> dict[str, Any]:
    with SCHEMA_PATH.open(encoding="utf-8") as f:
        loaded: dict[str, Any] = json.load(f)
    return loaded


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(create_app())


class TestEventSchemaContract:
    """run レスポンスの events[] が docs/event-schema.json に適合する。"""

    @pytest.mark.parametrize("algorithm", ALGORITHMS)
    def test_all_events_conform_to_schema(
        self, client: TestClient, schema: dict[str, Any], algorithm: str
    ) -> None:
        response = client.post("/api/v1/matching/run", json=REQUEST_BODIES[algorithm])

        assert response.status_code == 200
        events = response.json()["events"]
        assert events, f"{algorithm}: イベントログが空です"
        violations = [v for event in events for v in _validate(event, schema)]
        assert violations == [], f"{algorithm}: スキーマ違反: {violations}"

    def test_fixture_inputs_cover_all_event_types(self, client: TestClient) -> None:
        """3 入力の合計で全 6 イベント種別が出現する（スキーマの enum 全網羅）。"""
        observed: set[str] = set()
        for body in REQUEST_BODIES.values():
            events = client.post("/api/v1/matching/run", json=body).json()["events"]
            observed.update(event["event_type"] for event in events)

        assert observed == {member.value for member in EventType}

    def test_cutoff_raise_has_null_proposer_and_others_do_not(self, client: TestClient) -> None:
        """cutoff_raise のみ proposer が null。"""
        events = client.post("/api/v1/matching/run", json=REQUEST_BODIES["ca"]).json()["events"]

        cutoff_events = [e for e in events if e["event_type"] == "cutoff_raise"]
        other_events = [e for e in events if e["event_type"] != "cutoff_raise"]
        assert cutoff_events, "cutoff_raise イベントが出現していません"
        assert all(e["proposer"] is None for e in cutoff_events)
        assert all(isinstance(e["proposer"], int) for e in other_events)

    def test_schema_rejects_invalid_events(self, schema: dict[str, Any]) -> None:
        """スキーマ（と検証器）が不正イベントを検出できることの自己検証。"""
        valid = {"round": 1, "event_type": "propose", "proposer": 0, "receiver": 0}
        assert _validate(valid, schema) == []

        invalid_cases: list[dict[str, Any]] = [
            {**valid, "event_type": "unknown"},  # enum 違反
            {**valid, "round": 0},  # minimum 違反
            {**valid, "proposer": None},  # cutoff_raise 以外で null
            {**valid, "extra": 1},  # 未定義プロパティ
            {"event_type": "propose", "proposer": 0, "receiver": 0},  # round 欠落
            {"round": 1, "event_type": "cutoff_raise", "proposer": 0, "receiver": 0},
        ]
        for case in invalid_cases:
            assert _validate(case, schema), f"不正イベントが検出されませんでした: {case}"


class TestReconstructionViaApi:
    """レスポンスのイベントログから最終結果を再構成できる（API 経由の整合検証）。"""

    @pytest.mark.parametrize("algorithm", ALGORITHMS)
    def test_events_reconstruct_final_matching(self, client: TestClient, algorithm: str) -> None:
        body = REQUEST_BODIES[algorithm]

        result = client.post("/api/v1/matching/run", json=body).json()

        events = [
            MatchingEvent(
                round=e["round"],
                event_type=EventType(e["event_type"]),
                proposer=e["proposer"],
                receiver=e["receiver"],
                reason=e.get("reason"),
            )
            for e in result["events"]
        ]
        proposer_match, receiver_match = reconstruct_matching(
            events, len(body["proposer_prefs"]), len(body["receiver_prefs"])
        )
        assert proposer_match == result["proposer_match"]
        assert [sorted(m) for m in receiver_match] == [sorted(m) for m in result["receiver_match"]]
