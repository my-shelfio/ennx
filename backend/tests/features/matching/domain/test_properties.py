"""プロパティテスト（Hypothesis）。

ランダムな選好プロファイルに対し、各アルゴリズムの出力が満たすべき性質を検証する。

- 全アルゴリズム共通: 個人合理性（受け入れ不可能な相手とマッチしない）、定員制約の遵守
- DA: 安定性（ブロッキングペア 0 件）— Gale & Shapley (1962) の定理の実装保証
- FDA: 地域上限の充足（実行可能性）
- CA: 上限制約の充足と公平性（提案者最適公平マッチング）

実行時間がかかるため slow マーカーを付与する（pre-commit では除外、CI では実行）。
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from features.matching.domain import (
    CAInput,
    DAInput,
    FDAInput,
    MatchingResult,
    capacity_constraint,
    check_capacity_compliance,
    check_fairness,
    check_individual_rationality,
    check_stability,
    combined_constraint,
    cutoff_adjustment,
    deferred_acceptance,
    flexible_deferred_acceptance,
    reconstruct_matching,
)

pytestmark = pytest.mark.slow

MAX_PROPOSERS = 6
MAX_RECEIVERS = 4


@dataclass(frozen=True)
class Profile:
    """ランダム生成した選好プロファイル。"""

    proposer_prefs: list[list[int]]
    receiver_prefs: list[list[int]]


@st.composite
def profiles(draw: st.DrawFn) -> Profile:
    """選好プロファイル（両側とも部分リスト可）を生成する。"""
    n_p = draw(st.integers(min_value=1, max_value=MAX_PROPOSERS))
    n_r = draw(st.integers(min_value=1, max_value=MAX_RECEIVERS))
    proposer_prefs = [draw(st.permutations(range(1, n_r + 1))) for _ in range(n_p)]
    receiver_prefs = [draw(st.permutations(range(1, n_p + 1))) for _ in range(n_r)]
    # 部分リスト（受け入れ不可能な相手）を再現するため先頭から一部だけ残す
    proposer_prefs = [
        list(prefs)[: draw(st.integers(min_value=0, max_value=n_r))] for prefs in proposer_prefs
    ]
    receiver_prefs = [
        list(prefs)[: draw(st.integers(min_value=0, max_value=n_p))] for prefs in receiver_prefs
    ]
    return Profile(proposer_prefs=proposer_prefs, receiver_prefs=receiver_prefs)


@st.composite
def da_inputs(draw: st.DrawFn) -> DAInput:
    """DA のランダム入力を生成する。"""
    profile = draw(profiles())
    n_r = len(profile.receiver_prefs)
    capacities = [draw(st.integers(min_value=0, max_value=3)) for _ in range(n_r)]
    return DAInput(
        proposer_prefs=profile.proposer_prefs,
        receiver_prefs=profile.receiver_prefs,
        capacities=capacities,
    )


@st.composite
def fda_inputs(draw: st.DrawFn) -> FDAInput:
    """FDA のランダム入力を生成する。"""
    profile = draw(profiles())
    n_r = len(profile.receiver_prefs)
    capacities = [draw(st.integers(min_value=0, max_value=3)) for _ in range(n_r)]
    max_caps = [cap + draw(st.integers(min_value=0, max_value=2)) for cap in capacities]
    n_regions = draw(st.integers(min_value=1, max_value=n_r))
    regions = [draw(st.integers(min_value=0, max_value=n_regions - 1)) for _ in range(n_r)]
    # 実行可能性の前提条件: 地域内の目標定員合計 ≤ 地域上限（FDAInput が検証する）。
    # 待機リストからの繰り上げで上限が binding になるケースを残すため、余裕は小さくする。
    region_target = [0] * n_regions
    for j, region in enumerate(regions):
        region_target[region] += capacities[j]
    regional_caps = [
        target + draw(st.integers(min_value=0, max_value=2)) for target in region_target
    ]
    nomination_order = list(draw(st.permutations(range(n_r))))
    return FDAInput(
        proposer_prefs=profile.proposer_prefs,
        receiver_prefs=profile.receiver_prefs,
        capacities=capacities,
        max_caps=max_caps,
        regions=regions,
        regional_caps=regional_caps,
        nomination_order=nomination_order,
    )


@st.composite
def ca_inputs(draw: st.DrawFn) -> CAInput:
    """CA のランダム入力（定員制約 + 回避制約）を生成する。

    制約はいずれも遺伝性を満たす上限制約（CA の理論的前提）。
    """
    profile = draw(profiles())
    n_p = len(profile.proposer_prefs)
    n_r = len(profile.receiver_prefs)
    caps = [draw(st.integers(min_value=0, max_value=3)) for _ in range(n_r)]
    conflict_pairs: list[tuple[int, int]] = []
    if n_p >= 2:
        n_pairs = draw(st.integers(min_value=0, max_value=2))
        for _ in range(n_pairs):
            a = draw(st.integers(min_value=0, max_value=n_p - 2))
            b = draw(st.integers(min_value=a + 1, max_value=n_p - 1))
            conflict_pairs.append((a, b))
    constraints = [combined_constraint(cap, conflict_pairs) for cap in caps]
    return CAInput(
        proposer_prefs=profile.proposer_prefs,
        receiver_prefs=profile.receiver_prefs,
        constraints=constraints,
    )


def _assert_common_properties(
    data: DAInput | CAInput, result: MatchingResult, capacities: list[int]
) -> None:
    """全アルゴリズム共通: 個人合理性と定員遵守。"""
    ir = check_individual_rationality(
        data.proposer_prefs,
        data.receiver_prefs,
        result.proposer_match,
        result.receiver_match,
    )
    assert ir.passed, ir.violations

    cc = check_capacity_compliance(result.receiver_match, capacities)
    assert cc.passed, cc.violations

    # proposer_match と receiver_match の整合性
    for r, matched in enumerate(result.receiver_match):
        for p in matched:
            assert result.proposer_match[p] == r
    for p, r in enumerate(result.proposer_match):
        if r != -1:
            assert p in result.receiver_match[r]


@settings(max_examples=200, deadline=None)
@given(data=da_inputs())
def test_da_is_stable_and_individually_rational(data: DAInput) -> None:
    """DA: 個人合理性・定員遵守・安定性（Gale & Shapley 1962）。"""
    result = deferred_acceptance(data)

    _assert_common_properties(data, result, data.capacities)

    stability = check_stability(
        data.proposer_prefs,
        data.receiver_prefs,
        result.proposer_match,
        result.receiver_match,
        data.capacities,
    )
    assert stability.passed, stability.violations


@settings(max_examples=200, deadline=None)
@given(data=da_inputs())
def test_da_events_reconstruct_result(data: DAInput) -> None:
    """DA: イベントログから最終結果を再構成できる。"""
    result = deferred_acceptance(data)

    proposer_match, receiver_match = reconstruct_matching(
        result.events, data.n_proposers, data.n_receivers
    )

    assert proposer_match == result.proposer_match
    assert receiver_match == [set(matched) for matched in result.receiver_match]


@settings(max_examples=200, deadline=None)
@given(data=fda_inputs())
def test_fda_respects_regional_caps(data: FDAInput) -> None:
    """FDA: 個人合理性・設置上限遵守・地域上限の充足（実行可能性）。"""
    result = flexible_deferred_acceptance(data)

    _assert_common_properties(data, result, data.max_caps)

    # 地域上限の充足（実行可能性）
    regional_count = [0] * len(data.regional_caps)
    for r, matched in enumerate(result.receiver_match):
        regional_count[data.regions[r]] += len(matched)
    for region, count in enumerate(regional_count):
        assert count <= data.regional_caps[region], (
            f"地域 {region} の配属数 {count} が上限 {data.regional_caps[region]} を超過"
        )


@settings(max_examples=200, deadline=None)
@given(data=fda_inputs())
def test_fda_events_reconstruct_result(data: FDAInput) -> None:
    """FDA: イベントログから最終結果を再構成できる。"""
    result = flexible_deferred_acceptance(data)

    proposer_match, receiver_match = reconstruct_matching(
        result.events, data.n_proposers, data.n_receivers
    )

    assert proposer_match == result.proposer_match
    assert receiver_match == [set(matched) for matched in result.receiver_match]


@settings(max_examples=100, deadline=None)
@given(data=ca_inputs())
def test_ca_satisfies_constraints_and_fairness(data: CAInput) -> None:
    """CA: 個人合理性・上限制約の充足・公平性（提案者最適公平マッチング）。"""
    result = cutoff_adjustment(data)

    ir = check_individual_rationality(
        data.proposer_prefs,
        data.receiver_prefs,
        result.proposer_match,
        result.receiver_match,
    )
    assert ir.passed, ir.violations

    # 上限制約（定員 + 回避）の充足
    for r, matched in enumerate(result.receiver_match):
        assert data.constraints[r](frozenset(matched)), (
            f"受入者 {r} のマッチング {matched} が制約を満たさない"
        )

    # 公平性（正当な羨望なし）
    fairness = check_fairness(
        data.proposer_prefs,
        data.receiver_prefs,
        result.proposer_match,
        result.receiver_match,
    )
    assert fairness.passed, fairness.violations


@settings(max_examples=100, deadline=None)
@given(data=ca_inputs())
def test_ca_events_reconstruct_result(data: CAInput) -> None:
    """CA: イベントログから最終結果を再構成できる。"""
    result = cutoff_adjustment(data)

    proposer_match, receiver_match = reconstruct_matching(
        result.events, data.n_proposers, data.n_receivers
    )

    assert proposer_match == result.proposer_match
    assert receiver_match == [set(matched) for matched in result.receiver_match]


@settings(max_examples=100, deadline=None)
@given(data=da_inputs())
def test_ca_with_capacity_constraints_matches_da(data: DAInput) -> None:
    """CA: 定員制約のみの場合、DA と同一のマッチングになる（両者とも提案者最適）。"""
    da_result = deferred_acceptance(data)
    ca_result = cutoff_adjustment(
        CAInput(
            proposer_prefs=data.proposer_prefs,
            receiver_prefs=data.receiver_prefs,
            constraints=[capacity_constraint(cap) for cap in data.capacities],
        )
    )

    assert ca_result.proposer_match == da_result.proposer_match
