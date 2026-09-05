"""期待割当の性質検証のテスト。

移植元の実行例と同じ判定（PS は順序効率性・無羨望性・水平性を満たし、
耐戦略性を満たさない）になることを確認する。
"""

from __future__ import annotations

from fractions import Fraction

from features.assignment.domain import (
    AssignmentInput,
    check_envy_free,
    check_equal_treatment,
    check_ordinal_efficiency,
    check_strategy_proofness,
    probabilistic_serial,
)

_EXAMPLE1 = AssignmentInput(agent_prefs=[[1, 2], [1, 2], [2, 1], [2, 1]], capacities=[1, 1])
_EXAMPLE2 = AssignmentInput(agent_prefs=[[1, 2], [1], [2], [2]], capacities=[1, 1])


def test_ps_satisfies_equal_treatment_envy_free_and_efficiency() -> None:
    """PS は水平性・無羨望性・順序効率性を満たす。"""
    matrix = probabilistic_serial(_EXAMPLE1).expected_assignment

    assert check_equal_treatment(_EXAMPLE1, matrix)
    assert check_envy_free(_EXAMPLE1, matrix)
    assert check_ordinal_efficiency(_EXAMPLE1, matrix)


def test_ps_is_strategy_proof_in_this_example() -> None:
    """例1 では虚偽申告で得できる社員がいない。"""
    result = check_strategy_proofness(_EXAMPLE1, probabilistic_serial)

    assert result.passed
    assert result.violations == []


def test_ps_is_not_strategy_proof_in_general() -> None:
    """PS は耐戦略性を満たさない（虚偽申告で得できる社員が存在する）。"""
    result = check_strategy_proofness(_EXAMPLE2, probabilistic_serial)

    assert not result.passed
    assert len(result.violations) == 1
    assert "A1" in result.violations[0]


def test_equal_treatment_detects_violation() -> None:
    """同じ希望順位の社員に異なる期待割当を与えると水平性違反になる。"""
    matrix = [
        [Fraction(1), Fraction(0), Fraction(0)],
        [Fraction(0), Fraction(0), Fraction(1)],
        [Fraction(0), Fraction(1), Fraction(0)],
        [Fraction(0), Fraction(1), Fraction(0)],
    ]

    result = check_equal_treatment(_EXAMPLE1, matrix)

    assert not result.passed
    assert "A1" in result.violations[0]


def test_envy_free_detects_violation() -> None:
    """自分より良い割当を持つ社員がいれば無羨望性違反になる。"""
    matrix = [
        [Fraction(0), Fraction(0), Fraction(1)],
        [Fraction(1), Fraction(0), Fraction(0)],
        [Fraction(0), Fraction(1), Fraction(0)],
        [Fraction(0), Fraction(0), Fraction(1)],
    ]

    result = check_envy_free(_EXAMPLE1, matrix)

    assert not result.passed


def test_ordinal_efficiency_detects_waste() -> None:
    """空きがあるのに全員が ∅ を得ている割当は浪費として検出される。"""
    matrix = [[Fraction(0), Fraction(0), Fraction(1)] for _ in range(4)]

    result = check_ordinal_efficiency(_EXAMPLE1, matrix)

    assert not result.passed
    assert any("浪費" in violation for violation in result.violations)


def test_ordinal_efficiency_detects_improvement_cycle() -> None:
    """互いに相手の割当を好み合う配分は改善サイクルとして検出される。"""
    matrix = [
        [Fraction(0), Fraction(1), Fraction(0)],
        [Fraction(0), Fraction(0), Fraction(1)],
        [Fraction(1), Fraction(0), Fraction(0)],
        [Fraction(0), Fraction(0), Fraction(1)],
    ]

    result = check_ordinal_efficiency(_EXAMPLE1, matrix)

    assert not result.passed
    assert any("改善サイクル" in violation for violation in result.violations)
