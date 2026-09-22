"""デモ用サンプルのテスト。

各サンプルは導入ページから「その性質が効く様子」を見せるために用意しているため、
入力として妥当であることに加え、意図した現象が実際に起きることを固定する。
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from features.matching.application.dto.results import MatchingOutcome
from features.matching.application.errors import SampleNotFoundError
from features.matching.application.usecases import GetSample, ListSamples, RunMatching
from main import create_app


def _run(key: str) -> MatchingOutcome:
    return RunMatching().execute(GetSample().execute(key))


def _report_statuses(outcome: MatchingOutcome) -> dict[str, str]:
    return {item.label: item.status for item in outcome.report}


def test_all_samples_run_with_all_report_items_ok() -> None:
    """全サンプルが検証を通って実行でき、性質レポートがすべて ok になる。"""
    for sample in ListSamples().execute():
        outcome = _run(sample.key)
        assert set(_report_statuses(outcome).values()) == {"ok"}, sample.key


def test_default_sample_is_returned_when_key_is_omitted() -> None:
    """キー省略時は一覧の先頭（既定サンプル）を返す（旧 URL "?sample=1" の互換）。"""
    assert GetSample().execute() == ListSamples().execute()[0].request


def test_unknown_key_raises_not_found() -> None:
    with pytest.raises(SampleNotFoundError):
        GetSample().execute("no-such-sample")


def test_residency_sample_matches_everyone_stably() -> None:
    """研修医サンプル: 全員が配属され、安定である。"""
    outcome = _run("residency")
    assert outcome.unmatched == []
    assert _report_statuses(outcome)["安定性"] == "ok"


def test_regional_cap_sample_rejects_by_regional_cap_and_pushes_to_other_region() -> None:
    """地域上限サンプル: 地域上限を理由とする棄却が起き、首都圏は上限ちょうどで埋まる。"""
    outcome = _run("regional-cap")
    assert any(
        e.event_type == "reject" and e.reason is not None and e.reason.startswith("地域上限")
        for e in outcome.events
    )
    # 首都圏（部署 0・1）の配属合計が地域上限 2 に一致し、残りは大阪支社（部署 2）。
    assert len(outcome.receiver_match[0]) + len(outcome.receiver_match[1]) == 2
    assert outcome.unmatched == []
    # 首都圏を第 1 希望にしながら大阪支社へ繰り下がった社員がいる。
    request = GetSample().execute("regional-cap")
    pushed = [
        i
        for i, dep in enumerate(outcome.proposer_match)
        if dep == 2 and request.proposer_prefs[i][0] in (1, 2)
    ]
    assert pushed


def test_ng_pair_sample_raises_cutoff_and_separates_pair() -> None:
    """NG ペアサンプル: カットオフが引き上げられ、NG ペアが別部署に分離される。"""
    outcome = _run("ng-pair")
    assert any(e.event_type == "cutoff_raise" for e in outcome.events)
    assert max(outcome.cutoff) > 1
    assert outcome.proposer_match[0] != outcome.proposer_match[1]
    assert _report_statuses(outcome)["NG ペアの分離"] == "ok"


def test_unmatched_sample_leaves_employees_unmatched_with_rejections() -> None:
    """定員不足サンプル: 未配属が出て、未配属の社員は希望した全部署で棄却されている。"""
    outcome = _run("unmatched")
    request = GetSample().execute("unmatched")
    assert len(outcome.unmatched) == len(request.proposer_prefs) - sum(request.capacities)
    for employee in outcome.unmatched:
        rejected_by = {
            e.receiver
            for e in outcome.events
            if e.event_type == "reject" and e.proposer == employee
        }
        assert rejected_by == {dep - 1 for dep in request.proposer_prefs[employee]}


def test_every_listed_sample_can_be_fetched_and_run_via_api() -> None:
    """API 契約: 一覧のキーで各サンプルを取得でき、そのまま run に送信できる。未知キーは 404。"""
    client = TestClient(create_app())

    listed = client.get("/api/v1/samples").json()["samples"]
    assert [s["key"] for s in listed] == [s.key for s in ListSamples().execute()]
    for summary in listed:
        sample = client.get("/api/v1/sample", params={"key": summary["key"]}).json()
        assert sample["constraint_type"] == summary["constraint_type"]
        assert client.post("/api/v1/matching/run", json=sample).status_code == 200

    assert (
        client.get("/api/v1/sample").json()
        == client.get("/api/v1/sample", params={"key": listed[0]["key"]}).json()
    )
    missing = client.get("/api/v1/sample", params={"key": "no-such-sample"})
    assert missing.status_code == 404
    assert missing.headers["content-type"].startswith("application/problem+json")
