"""CA アルゴリズムのテスト。"""

from __future__ import annotations

import pytest

from features.matching.domain import (
    CAInput,
    all_constraints,
    budget_constraint,
    capacity_constraint,
    collision_avoidance_constraint,
    combined_constraint,
    cutoff_adjustment,
)


def test_example1_capacity_only_matches_da() -> None:
    """例1: 定員制約のみ → DA と同じ安定マッチングになる。"""
    data = CAInput(
        proposer_prefs=[
            [1, 2, 3, 4],
            [1, 3, 2, 4],
            [2, 1, 3, 4],
            [3, 2, 1, 4],
        ],
        receiver_prefs=[
            [2, 1, 3, 4],
            [1, 2, 4, 3],
            [4, 3, 1, 2],
            [3, 4, 2, 1],
        ],
        constraints=[capacity_constraint(1) for _ in range(4)],
    )

    result = cutoff_adjustment(data)

    assert result.proposer_match == [1, 0, 3, 2]
    assert result.receiver_match == [[1], [0], [3], [2]]
    assert result.cutoff_profile == [4, 2, 4, 1]


def test_example2_budget_constraint() -> None:
    """例2: 予算制約（保育園マッチング）。

    コスト 1/3 の児童2人 + 1/6 の児童2人 = 1.0 で予算ちょうど。
    5人目（けんた）は予算超過のため未配分になる。
    """
    costs = {0: 1 / 3, 1: 1 / 3, 2: 1 / 6, 3: 1 / 6, 4: 1 / 6}
    data = CAInput(
        proposer_prefs=[[1]] * 5,
        receiver_prefs=[[1, 2, 3, 4, 5]],
        constraints=[budget_constraint(costs, budget=1.0)],
    )

    result = cutoff_adjustment(data)

    assert result.proposer_match == [0, 0, 0, 0, -1]
    assert result.receiver_match == [[0, 1, 2, 3]]
    assert result.cutoff_profile == [2]
    # 予算制約の充足を直接確認
    assert sum(costs[p] for p in result.receiver_match[0]) <= 1.0


def test_example3_collision_avoidance() -> None:
    """例3: 回避制約（同一クラスへの配属禁止ペア4組）。"""
    conflict_pairs = [(0, 1), (2, 3), (4, 5), (6, 7)]
    data = CAInput(
        proposer_prefs=[
            [1, 2, 3, 4],
            [1, 3, 2, 4],
            [2, 1, 3, 4],
            [2, 4, 3, 1],
            [3, 2, 1, 4],
            [3, 4, 2, 1],
            [4, 1, 3, 2],
            [4, 2, 1, 3],
        ],
        receiver_prefs=[
            [1, 3, 5, 7, 6, 4, 8, 2],
            [3, 1, 5, 7, 6, 2, 8, 4],
            [5, 3, 1, 7, 2, 8, 4, 6],
            [7, 5, 3, 1, 4, 2, 6, 8],
        ],
        constraints=[collision_avoidance_constraint(conflict_pairs) for _ in range(4)],
    )

    result = cutoff_adjustment(data)

    assert result.proposer_match == [0, 2, 1, 3, 2, 3, 3, 1]
    assert result.receiver_match == [[0], [2, 7], [1, 4], [3, 5, 6]]
    assert result.cutoff_profile == [2, 2, 2, 2]
    # NGペアが分離されていることを直接確認
    for a, b in conflict_pairs:
        ra, rb = result.proposer_match[a], result.proposer_match[b]
        assert not (ra == rb and ra != -1)


def test_combined_constraint() -> None:
    """複合制約（定員 + 回避）は両条件を同時に判定する。"""
    constraint = combined_constraint(2, [(0, 1)])

    assert constraint(frozenset())
    assert constraint(frozenset({0, 2}))
    assert not constraint(frozenset({0, 1}))  # NGペア
    assert not constraint(frozenset({0, 2, 3}))  # 定員超過


def test_all_constraints_combines_arbitrary_number_of_constraints() -> None:
    """all_constraints は任意個の制約すべてを同時に満たす場合のみ実行可能と判定する。"""
    constraint = all_constraints(
        [
            capacity_constraint(2),
            collision_avoidance_constraint([(0, 1)]),
            budget_constraint({0: 0.5, 1: 0.5, 2: 0.9}, budget=1.0),
        ]
    )

    assert constraint(frozenset())  # 空集合は常に実行可能（遺伝性）
    assert constraint(frozenset({0}))  # 定員・NGペア・予算（0.5）すべて満たす
    assert not constraint(frozenset({0, 1}))  # NGペア違反
    assert not constraint(frozenset({0, 2}))  # 予算超過（0.5 + 0.9 > 1.0）
    assert not constraint(frozenset({0, 1, 2}))  # 定員超過（3 > 2）に加え他も違反


def test_all_constraints_with_no_constraints_is_always_feasible() -> None:
    """制約が空リストの場合は常に実行可能（all() の空積は True）。"""
    constraint = all_constraints([])

    assert constraint(frozenset())
    assert constraint(frozenset({0, 1, 2}))


class TestCAInputValidation:
    """CAInput の入力検証。"""

    def test_constraints_length_mismatch_raises(self) -> None:
        """constraints の長さ不一致は ValueError。"""
        with pytest.raises(ValueError, match="constraints"):
            CAInput(
                proposer_prefs=[[1, 2]],
                receiver_prefs=[[1], [1]],
                constraints=[capacity_constraint(1)],
            )

    def test_lower_bound_constraint_rejected(self) -> None:
        """空集合を実行不可能とする制約（下限制約）は ValueError。"""
        with pytest.raises(ValueError, match="遺伝性"):
            CAInput(
                proposer_prefs=[[1]],
                receiver_prefs=[[1]],
                constraints=[lambda proposers: len(proposers) >= 1],
            )
