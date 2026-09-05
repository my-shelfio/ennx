"""割り当て問題のプロパティテスト（Hypothesis）。

ランダムな希望順位プロファイルに対し、PS と一般化BvN 分解が満たすべき性質を検証する。

- PS: 行和が 1・供給数の遵守・受け入れ不可能な対象に正の確率を割り当てない
- PS: イベントログから期待割当行列を再構成できる
- PS: 水平性・無羨望性・順序効率性（Bogomolnaia and Moulin, 2001 の定理の実装保証）
- 一般化BvN: 重みの総和が 1・再構成が元の期待割当と一致・全項が制約を満たす

実行時間がかかるため slow マーカーを付与する（pre-commit では除外、CI では実行）。
"""

from __future__ import annotations

from fractions import Fraction

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from features.assignment.domain import (
    AssignmentInput,
    UpperConstraint,
    build_constraint_structure,
    check_envy_free,
    check_equal_treatment,
    check_ordinal_efficiency,
    decompose,
    probabilistic_serial,
    quota_violations,
    reconstruct,
    reconstruct_expected_assignment,
    verify,
)

pytestmark = pytest.mark.slow

MAX_AGENTS = 5
MAX_OBJECTS = 4


@st.composite
def assignment_inputs(draw: st.DrawFn, *, with_constraints: bool = False) -> AssignmentInput:
    """希望順位プロファイル（部分リスト可）と供給数を生成する。"""
    n_agents = draw(st.integers(min_value=1, max_value=MAX_AGENTS))
    n_objects = draw(st.integers(min_value=1, max_value=MAX_OBJECTS))
    agent_prefs = [
        list(draw(st.permutations(range(1, n_objects + 1))))[
            : draw(st.integers(min_value=0, max_value=n_objects))
        ]
        for _ in range(n_agents)
    ]
    capacities = [draw(st.integers(min_value=0, max_value=3)) for _ in range(n_objects)]

    constraints: list[UpperConstraint] = []
    if with_constraints and n_agents >= 2:
        # 同じ列の部分列制約のみを課す（列制約と入れ子になり bihierarchy を保つ）
        obj = draw(st.integers(min_value=0, max_value=n_objects - 1))
        members = draw(
            st.lists(
                st.integers(min_value=0, max_value=n_agents - 1),
                min_size=2,
                max_size=n_agents,
                unique=True,
            )
        )
        upper = draw(st.integers(min_value=0, max_value=len(members)))
        constraints.append(
            UpperConstraint(
                cells=frozenset({(i, obj) for i in members}), upper=upper, label="部分列クォータ"
            )
        )
    return AssignmentInput(agent_prefs=agent_prefs, capacities=capacities, constraints=constraints)


@given(assignment_inputs())
@settings(max_examples=60, deadline=None)
def test_expected_assignment_is_feasible(data: AssignmentInput) -> None:
    """期待割当は行和 1・供給数以下・受け入れ不可能な対象の確率 0 を満たす。"""
    matrix = probabilistic_serial(data).expected_assignment

    for row in matrix:
        assert sum(row, Fraction(0)) == 1
        assert all(value >= 0 for value in row)
    for obj in range(data.n_objects):
        used = sum((matrix[i][obj] for i in range(data.n_agents)), Fraction(0))
        assert used <= data.capacities[obj]
    for i in range(data.n_agents):
        acceptable = set(data.acceptable(i))
        for obj in range(data.n_objects):
            if obj not in acceptable:
                assert matrix[i][obj] == 0


@given(assignment_inputs(with_constraints=True))
@settings(max_examples=60, deadline=None)
def test_upper_constraints_are_respected(data: AssignmentInput) -> None:
    """追加の上限制約は期待割当でも守られる。"""
    matrix = probabilistic_serial(data).expected_assignment

    for constraint in data.constraints:
        total = sum((matrix[i][j] for (i, j) in constraint.cells), Fraction(0))
        assert total <= constraint.upper


@given(assignment_inputs(with_constraints=True))
@settings(max_examples=60, deadline=None)
def test_events_reconstruct_expected_assignment(data: AssignmentInput) -> None:
    """イベントログだけから期待割当行列を再構成できる。"""
    result = probabilistic_serial(data)

    assert (
        reconstruct_expected_assignment(result.events, data.n_agents, data.n_objects)
        == result.expected_assignment
    )


@given(assignment_inputs())
@settings(max_examples=60, deadline=None)
def test_ps_guaranteed_properties(data: AssignmentInput) -> None:
    """PS は水平性・無羨望性・順序効率性を満たす（上限制約なしの場合）。"""
    matrix = probabilistic_serial(data).expected_assignment

    assert check_equal_treatment(data, matrix).passed
    assert check_envy_free(data, matrix).passed
    assert check_ordinal_efficiency(data, matrix).passed


@given(assignment_inputs(with_constraints=True))
@settings(max_examples=40, deadline=None)
def test_lottery_decomposition_is_valid(data: AssignmentInput) -> None:
    """くじの重みの総和は 1 で、再構成が一致し、全項が制約を満たす。"""
    matrix = probabilistic_serial(data).expected_assignment
    structure = build_constraint_structure(data)

    terms = decompose(matrix, structure)

    assert verify(terms, matrix, structure) == []
    assert sum((term.weight for term in terms), Fraction(0)) == 1
    assert reconstruct(terms, structure.n_agents, structure.n_columns) == matrix
    for term in terms:
        pure = [[Fraction(value) for value in row] for row in term.assignment]
        assert quota_violations(pure, structure) == []
        for row in term.assignment:
            assert sum(row) == 1
