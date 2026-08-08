"""投票ルール（domain/voting）の集計テスト。"""

from __future__ import annotations

import pytest

from features.voting.domain import (
    ApprovalTallyInput,
    ChoiceTallyInput,
    RankingTallyInput,
    condorcet_winner,
    pairwise_matrix,
    tally_approval,
    tally_borda,
    tally_condorcet,
    tally_plurality,
)
from features.voting.domain.rules import first_choices


class TestPlurality:
    def test_counts_votes(self) -> None:
        result = tally_plurality(ChoiceTallyInput(num_options=3, choices=[0, 0, 1, 2, 0]))
        assert result.scores == [3.0, 1.0, 1.0]
        assert result.winners == [0]
        assert result.ranking == [0, 1, 2]

    def test_tie_returns_all_winners(self) -> None:
        result = tally_plurality(ChoiceTallyInput(num_options=2, choices=[0, 1]))
        assert result.winners == [0, 1]

    def test_out_of_range_choice_raises(self) -> None:
        with pytest.raises(ValueError):
            ChoiceTallyInput(num_options=2, choices=[2])


class TestBorda:
    def test_borda_scores(self) -> None:
        # 2 票: [0,1,2] と [1,0,2] → 0: 2+1=3, 1: 1+2=3, 2: 0+0=0
        result = tally_borda(RankingTallyInput(num_options=3, rankings=[[0, 1, 2], [1, 0, 2]]))
        assert result.scores == [3.0, 3.0, 0.0]
        assert result.winners == [0, 1]

    def test_incomplete_ranking_raises(self) -> None:
        with pytest.raises(ValueError):
            RankingTallyInput(num_options=3, rankings=[[0, 1]])

    def test_duplicated_ranking_raises(self) -> None:
        with pytest.raises(ValueError):
            RankingTallyInput(num_options=3, rankings=[[0, 0, 1]])


class TestApproval:
    def test_approval_counts(self) -> None:
        result = tally_approval(ApprovalTallyInput(num_options=3, approvals=[[0, 1], [1], [1, 2]]))
        assert result.scores == [1.0, 3.0, 1.0]
        assert result.winners == [1]

    def test_duplicate_approval_raises(self) -> None:
        with pytest.raises(ValueError):
            ApprovalTallyInput(num_options=3, approvals=[[1, 1]])


class TestCondorcet:
    def test_condorcet_winner_exists(self) -> None:
        # 中位の選択肢 1 が全ペア比較で勝つプロファイル。
        rankings = [[0, 1, 2], [1, 0, 2], [1, 2, 0], [2, 1, 0], [1, 0, 2]]
        tally_input = RankingTallyInput(num_options=3, rankings=rankings)
        assert condorcet_winner(tally_input) == 1
        result = tally_condorcet(tally_input)
        assert result.winners == [1]

    def test_condorcet_paradox_returns_none(self) -> None:
        # 循環（0>1>2, 1>2>0, 2>0>1）ではコンドルセ勝者が存在しない。
        rankings = [[0, 1, 2], [1, 2, 0], [2, 0, 1]]
        tally_input = RankingTallyInput(num_options=3, rankings=rankings)
        assert condorcet_winner(tally_input) is None
        # Copeland スコアは全員同点（勝ち 1・負け 1）。
        assert tally_condorcet(tally_input).winners == [0, 1, 2]

    def test_pairwise_matrix(self) -> None:
        tally_input = RankingTallyInput(num_options=2, rankings=[[0, 1], [0, 1], [1, 0]])
        assert pairwise_matrix(tally_input) == [[0, 2], [1, 0]]

    def test_majority_paradox_profile(self) -> None:
        # 多数決の逆理の古典例: 有権者 20 人が [0,1,2] 8 人・[1,2,0] 7 人・
        # [2,1,0] 5 人に分かれる場合、多数決の勝者(0)とコンドルセ勝者(1)が
        # 食い違う（0 は第 1 希望で最多だが、1 対 1 では 1 に負ける）。
        rankings = [[0, 1, 2]] * 8 + [[1, 2, 0]] * 7 + [[2, 1, 0]] * 5
        tally_input = RankingTallyInput(num_options=3, rankings=rankings)
        plurality = tally_plurality(first_choices(tally_input))
        assert plurality.winners == [0]
        assert condorcet_winner(tally_input) == 1
