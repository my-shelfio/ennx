"""投票ルールのプロパティテスト（Hypothesis）。

ランダムな順位付けプロファイルに対し、集計結果が満たすべき性質を検証する。
実行時間がかかるため slow マーカーを付与する（pre-commit では除外、CI では実行）。
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from features.voting.domain import (
    RankingTallyInput,
    condorcet_winner,
    pairwise_matrix,
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
