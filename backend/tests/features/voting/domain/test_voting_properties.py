"""投票ルールのプロパティテスト（Hypothesis）。

ランダムな順位付けプロファイル・承認プロファイルに対し、集計結果が満たすべき性質を検証する。
実行時間がかかるため slow マーカーを付与する（pre-commit では除外、CI では実行）。
"""

from __future__ import annotations

import pytest
from hypothesis import assume, given, settings
from hypothesis import strategies as st

from features.voting.domain import (
    ApprovalTallyInput,
    RankingTallyInput,
    RuleResult,
    condorcet_winner,
    pairwise_matrix,
    tally_approval,
    tally_borda,
    tally_condorcet,
    tally_plurality,
)
from features.voting.domain.rules import first_choices

pytestmark = pytest.mark.slow


@st.composite
def ranking_profiles(draw: st.DrawFn) -> RankingTallyInput:
    num_options = draw(st.integers(min_value=2, max_value=6))
    num_voters = draw(st.integers(min_value=1, max_value=12))
    rankings = [draw(st.permutations(list(range(num_options)))) for _ in range(num_voters)]
    return RankingTallyInput(num_options=num_options, rankings=[list(r) for r in rankings])


@given(profile=ranking_profiles())
@settings(max_examples=200, deadline=None)
def test_condorcet_winner_beats_all_pairwise(profile: RankingTallyInput) -> None:
    """コンドルセ勝者が存在するなら、全ペア比較で過半数勝ちしている。"""
    winner = condorcet_winner(profile)
    if winner is None:
        return
    matrix = pairwise_matrix(profile)
    for other in range(profile.num_options):
        if other != winner:
            assert matrix[winner][other] > matrix[other][winner]


@given(profile=ranking_profiles())
@settings(max_examples=200, deadline=None)
def test_condorcet_winner_is_copeland_top(profile: RankingTallyInput) -> None:
    """コンドルセ勝者が存在するなら、Copeland 集計でも単独勝者になる。"""
    winner = condorcet_winner(profile)
    if winner is None:
        return
    assert tally_condorcet(profile).winners == [winner]


@given(profile=ranking_profiles())
@settings(max_examples=200, deadline=None)
def test_scores_are_consistent(profile: RankingTallyInput) -> None:
    """各ルールのスコア合計・順位がスコアと整合している。"""
    for result in (
        tally_borda(profile),
        tally_condorcet(profile),
        tally_plurality(first_choices(profile)),
    ):
        assert len(result.scores) == profile.num_options
        # ranking はスコア降順（同点はインデックス昇順）。
        sorted_scores = [result.scores[o] for o in result.ranking]
        assert sorted_scores == sorted(sorted_scores, reverse=True)
        top = max(result.scores)
        assert result.winners == [o for o, score in enumerate(result.scores) if score == top]


@given(profile=ranking_profiles())
@settings(max_examples=200, deadline=None)
def test_borda_total_is_conserved(profile: RankingTallyInput) -> None:
    """ボルダ点の合計は 投票数 × n(n-1)/2 に一致する（点の保存）。"""
    n = profile.num_options
    result = tally_borda(profile)
    assert sum(result.scores) == len(profile.rankings) * n * (n - 1) / 2


@st.composite
def approval_ballots(draw: st.DrawFn, num_options: int) -> list[int]:
    """1 票分の承認リスト。0 件承認から全件承認までの任意の部分集合を、任意の並び順で返す。"""
    size = draw(st.integers(min_value=0, max_value=num_options))
    order = draw(st.permutations(list(range(num_options))))
    return list(order[:size])


@st.composite
def approval_profiles(draw: st.DrawFn) -> ApprovalTallyInput:
    num_options = draw(st.integers(min_value=2, max_value=6))
    num_voters = draw(st.integers(min_value=1, max_value=12))
    approvals = [draw(approval_ballots(num_options)) for _ in range(num_voters)]
    return ApprovalTallyInput(num_options=num_options, approvals=approvals)


def _expected_approval_counts(profile: ApprovalTallyInput) -> list[float]:
    return [
        float(sum(1 for approval in profile.approvals if option in approval))
        for option in range(profile.num_options)
    ]


def _assert_ranking_and_winners_follow_scores(result: RuleResult) -> None:
    n = len(result.scores)
    assert result.ranking == sorted(range(n), key=lambda o: (-result.scores[o], o))
    top = max(result.scores)
    assert result.winners == [o for o, score in enumerate(result.scores) if score == top]


@given(profile=approval_profiles())
@settings(max_examples=200, deadline=None)
def test_approval_score_equals_number_of_approving_ballots(profile: ApprovalTallyInput) -> None:
    """各選択肢のスコアは、その選択肢を承認した票の数に一致する。"""
    assert tally_approval(profile).scores == _expected_approval_counts(profile)


@given(profile=approval_profiles())
@settings(max_examples=200, deadline=None)
def test_approval_total_is_conserved(profile: ApprovalTallyInput) -> None:
    """スコアの合計は全票の承認数の総和に一致する（承認の保存）。"""
    total_approvals = sum(len(approval) for approval in profile.approvals)
    assert sum(tally_approval(profile).scores) == total_approvals


@given(profile=approval_profiles())
@settings(max_examples=200, deadline=None)
def test_approval_ranking_and_winners_follow_scores(profile: ApprovalTallyInput) -> None:
    """winners は最大スコアの選択肢集合、ranking はスコア降順（同点はインデックス昇順）。"""
    _assert_ranking_and_winners_follow_scores(tally_approval(profile))


@given(profile=approval_profiles(), data=st.data())
@settings(max_examples=200, deadline=None)
def test_approval_is_monotonic(profile: ApprovalTallyInput, data: st.DataObject) -> None:
    """ある票に選択肢 o の承認を 1 件足すと、o のスコアだけが 1 増える（単調性）。"""
    voter = data.draw(st.integers(min_value=0, max_value=len(profile.approvals) - 1))
    missing = [o for o in range(profile.num_options) if o not in profile.approvals[voter]]
    assume(missing)
    added = data.draw(st.sampled_from(missing))

    approvals = [list(approval) for approval in profile.approvals]
    approvals[voter].append(added)
    before = tally_approval(profile).scores
    after = tally_approval(
        ApprovalTallyInput(num_options=profile.num_options, approvals=approvals)
    ).scores

    for option in range(profile.num_options):
        expected = before[option] + (1.0 if option == added else 0.0)
        assert after[option] == expected


@given(
    num_options=st.integers(min_value=2, max_value=6),
    num_voters=st.integers(min_value=1, max_value=12),
)
@settings(max_examples=50, deadline=None)
def test_approval_all_empty_ballots_tie_every_option(num_options: int, num_voters: int) -> None:
    """全員が 0 件承認なら全選択肢が同点（スコア 0）で、winners は全選択肢になる。"""
    profile = ApprovalTallyInput(num_options=num_options, approvals=[[] for _ in range(num_voters)])
    result = tally_approval(profile)
    assert result.scores == [0.0] * num_options
    assert result.winners == list(range(num_options))
    assert result.ranking == list(range(num_options))
