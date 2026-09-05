"""期待割当の性質検証のテスト。

移植元の実行例と同じ判定（PS は順序効率性・無羨望性・水平性を満たし、
耐戦略性を満たさない）になることを確認する。
"""

from __future__ import annotations

from fractions import Fraction

import pytest

from features.assignment.domain import (
    AssignmentInput,
    UpperConstraint,
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


_NG_PAIR = AssignmentInput(
    agent_prefs=[[1, 2, 3], [1, 2, 3], [1, 2, 3], [2, 1, 3], [2, 3, 1]],
    capacities=[2, 2, 1],
    constraints=[
        UpperConstraint(cells=frozenset({(1, j), (2, j)}), upper=1, label=f"NG ペア（対象 {j}）")
        for j in range(3)
    ],
)
_GROUP_QUOTA = AssignmentInput(
    agent_prefs=[[1, 2], [1, 2], [1, 2], [2, 1], [1, 2], [2, 1]],
    capacities=[2, 2],
    constraints=[
        UpperConstraint(
            cells=frozenset({(i, j) for i in (1, 2, 4)}), upper=1, label=f"クォータ（対象 {j}）"
        )
        for j in range(2)
    ],
)


@pytest.mark.parametrize(("data", "label"), [(_NG_PAIR, "NG ペア"), (_GROUP_QUOTA, "クォータ")])
def test_constrained_ps_satisfies_the_constrained_properties(
    data: AssignmentInput, label: str
) -> None:
    """上限制約付きでも、制約を織り込んだ定義では性質違反が出ない。

    制約を無視した定義（制約で得られない割当への羨望まで数える等）では
    正しい結果に対して違反を報告してしまうため、この確認を回帰テストとして残す。
    """
    matrix = probabilistic_serial(data).expected_assignment

    assert check_equal_treatment(data, matrix).passed, label
    assert check_envy_free(data, matrix).passed, label
    assert check_ordinal_efficiency(data, matrix).passed, label


def test_ordinal_efficiency_is_partial_under_constraints() -> None:
    """追加制約があるときは判定範囲が非浪費性までであることを返す。"""
    matrix = probabilistic_serial(_NG_PAIR).expected_assignment

    assert check_ordinal_efficiency(_NG_PAIR, matrix).partial
    assert not check_ordinal_efficiency(
        _EXAMPLE1, probabilistic_serial(_EXAMPLE1).expected_assignment
    ).partial


def test_equal_treatment_ignores_agents_split_by_a_constraint() -> None:
    """片方だけが制約対象の 2 人は、希望順位が同じでも同値ではない。"""
    data = AssignmentInput(
        agent_prefs=[[1, 2], [1, 2]],
        capacities=[1, 1],
        constraints=[UpperConstraint(cells=frozenset({(0, 0)}), upper=0, label="社員1は対象1不可")],
    )
    matrix = probabilistic_serial(data).expected_assignment

    assert matrix[0] != matrix[1]
    assert check_equal_treatment(data, matrix).passed


def test_envy_is_ignored_when_the_swap_breaks_a_constraint() -> None:
    """入れ替えると制約を破る相手への羨望は、正当な羨望として数えない。"""
    data = AssignmentInput(
        agent_prefs=[[1, 2], [1, 2]],
        capacities=[1, 1],
        constraints=[UpperConstraint(cells=frozenset({(0, 0)}), upper=0, label="社員1は対象1不可")],
    )
    matrix = probabilistic_serial(data).expected_assignment

    # 社員1 は対象1 を得られないため、社員2 の割当を厳密に選好する
    assert not _weakly_dominates_row(matrix[0], matrix[1])
    # しかし入れ替えると制約（社員1 は対象1 不可）を破るので、正当な羨望ではない
    assert check_envy_free(data, matrix).passed


def _weakly_dominates_row(row_x: list[Fraction], row_y: list[Fraction]) -> bool:
    """先頭列（第 1 希望）の確率で弱支配を粗く判定するテスト用ヘルパ。"""
    return row_x[0] >= row_y[0]
