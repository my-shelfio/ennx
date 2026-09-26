"""一般化 BvN 分解のフィクスチャテスト。

期待値は移植元（Budish, Che, Kojima and Milgrom 2013 の実装サンプル）の
実行例を実行して確定した値。
"""

from __future__ import annotations

import random
from fractions import Fraction

import pytest

from features.assignment.domain import (
    AssignmentInput,
    ConstraintSet,
    ConstraintStructure,
    DecompositionError,
    LotteryTooLargeError,
    UpperConstraint,
    build_constraint_structure,
    column_set,
    decompose,
    find_bihierarchy,
    find_odd_cycle,
    is_hierarchy,
    probabilistic_serial,
    quota_violations,
    reconstruct,
    row_set,
    sample_pure_assignment,
    verify,
)


def _lottery(data: AssignmentInput) -> tuple[list[tuple[str, list[list[int]]]], list[str]]:
    """PS を実行してくじに分解し、(重みと純割当, 検証結果) を返す。"""
    matrix = probabilistic_serial(data).expected_assignment
    structure = build_constraint_structure(data)
    terms = decompose(matrix, structure)
    return (
        [(str(term.weight), term.assignment) for term in terms],
        verify(terms, matrix, structure),
    )


def test_school_choice_pipeline() -> None:
    """選好 → PS → 一般化BvN の一気通貫（学校選択・グループ別クォータ）。"""
    data = AssignmentInput(
        agent_prefs=[[1, 2], [1, 2], [2, 1], [2, 1]],
        capacities=[2, 1],
        constraints=[
            UpperConstraint(
                cells=frozenset({(0, 0), (1, 0), (2, 0)}), upper=1, label="学生 1〜3 から高々 1 人"
            )
        ],
    )

    terms, problems = _lottery(data)

    assert problems == []
    assert terms == [
        ("1/4", [[0, 0, 1], [1, 0, 0], [0, 0, 1], [0, 1, 0]]),
        ("1/4", [[0, 0, 1], [1, 0, 0], [0, 1, 0], [1, 0, 0]]),
        ("1/4", [[1, 0, 0], [0, 0, 1], [0, 0, 1], [0, 1, 0]]),
        ("1/4", [[1, 0, 0], [0, 0, 1], [0, 1, 0], [1, 0, 0]]),
    ]


def test_project_assignment_pipeline() -> None:
    """NG ペア制約は、くじのどの項でも守られる（期待値では見えない保証）。"""
    data = AssignmentInput(
        agent_prefs=[[1, 2], [1, 2], [1, 2], [2, 1]],
        capacities=[2, 2],
        constraints=[UpperConstraint(cells=frozenset({(0, 0), (1, 0)}), upper=1, label="NG ペア")],
    )

    terms, problems = _lottery(data)

    assert problems == []
    assert terms == [
        ("1/2", [[0, 1, 0], [1, 0, 0], [1, 0, 0], [0, 1, 0]]),
        ("1/2", [[1, 0, 0], [0, 1, 0], [1, 0, 0], [0, 1, 0]]),
    ]
    for _, assignment in terms:
        assert assignment[0][0] + assignment[1][0] <= 1


def test_subcolumn_quota_decomposition() -> None:
    """部分列制約（アファーマティブ・アクション型）付きの期待割当を分解する。

    行・列・部分列の 3 つの和がいずれも整数になるため、1 つのセルが 3 つの等式に属し、
    方向探索は交代閉路では表せない。連立一次方程式の受け皿を通る経路の検証を兼ねる。
    """
    matrix = [
        [Fraction(1, 2), Fraction(1, 5), Fraction(3, 10)],
        [Fraction(1, 2), Fraction(1, 2), Fraction(0)],
        [Fraction(4, 5), Fraction(0), Fraction(1, 5)],
        [Fraction(1, 5), Fraction(3, 10), Fraction(1, 2)],
    ]
    structure = ConstraintStructure(
        n_agents=4,
        n_columns=3,
        sets=[
            *[row_set(i, 3, 1, 1) for i in range(4)],
            column_set(0, 4, 0, 2),
            column_set(1, 4, 0, 1),
            column_set(2, 4, 0, 1),
            ConstraintSet(cells=frozenset({(0, 0), (1, 0)}), floor=1, ceil=1, name="部分列"),
        ],
    ).with_singletons(0, 1)

    terms = decompose(matrix, structure)

    assert verify(terms, matrix, structure) == []
    assert len(terms) == 5
    assert sum((term.weight for term in terms), Fraction(0)) == 1
    assert reconstruct(terms, 4, 3) == matrix
    for term in terms:
        assert term.assignment[0][0] + term.assignment[1][0] == 1


def test_bihierarchy_split_of_generated_structure() -> None:
    """入力から組み立てた制約構造は 2 つの階層に分割できる。"""
    data = AssignmentInput(
        agent_prefs=[[1, 2], [1, 2], [2, 1], [2, 1]],
        capacities=[2, 1],
        constraints=[
            UpperConstraint(cells=frozenset({(0, 0), (1, 0), (2, 0)}), upper=1, label="上限 1")
        ],
    )

    structure = build_constraint_structure(data)
    split = find_bihierarchy(structure)

    assert split is not None
    assert len(structure.sets) == 19
    assert sorted(len(part) for part in split) == [3, 16]
    for part in split:
        assert is_hierarchy(part)


def test_odd_cycle_is_rejected() -> None:
    """交差する制約（奇サイクル）は分解できず、理由として制約名を返す。"""
    structure = ConstraintStructure(
        n_agents=2,
        n_columns=2,
        sets=[
            ConstraintSet(cells=frozenset({(0, 0), (0, 1)}), floor=1, ceil=1, name="第 1 行"),
            ConstraintSet(cells=frozenset({(0, 0), (1, 0)}), floor=1, ceil=1, name="第 1 列"),
            ConstraintSet(cells=frozenset({(0, 1), (1, 0)}), floor=1, ceil=1, name="対角集合"),
        ],
    )

    assert find_bihierarchy(structure) is None
    assert [s.name for s in (find_odd_cycle(structure) or [])] == ["第 1 行", "第 1 列", "対角集合"]

    matrix = [[Fraction(1, 2), Fraction(1, 2)], [Fraction(1, 2), Fraction(1, 2)]]
    with pytest.raises(DecompositionError, match="第 1 行"):
        decompose(matrix, structure)


def test_quota_violation_is_rejected() -> None:
    """制約を満たさない期待割当は分解を試みる前に弾かれる。"""
    data = AssignmentInput(agent_prefs=[[1], [1]], capacities=[1])
    structure = build_constraint_structure(data)
    matrix = [[Fraction(1), Fraction(0)], [Fraction(1), Fraction(0)]]

    with pytest.raises(DecompositionError, match="期待割当が制約を満たしていません"):
        decompose(matrix, structure)


def test_integer_matrix_is_a_single_term() -> None:
    """期待割当がすでに整数行列なら、くじは 1 項（確率 1）になる。"""
    data = AssignmentInput(agent_prefs=[[1], [2]], capacities=[1, 1])

    terms, problems = _lottery(data)

    assert problems == []
    assert terms == [("1", [[1, 0, 0], [0, 1, 0]])]


def test_sampling_reproduces_the_full_lottery_distribution() -> None:
    """抽選の分布が全分解の重みと一致する（同じ入力を多数回引いて確認する）。"""
    data = AssignmentInput(
        agent_prefs=[[1, 2], [1, 2], [2, 1], [2, 1]],
        capacities=[2, 1],
        constraints=[
            UpperConstraint(cells=frozenset({(0, 0), (1, 0), (2, 0)}), upper=1, label="上限 1")
        ],
    )
    matrix = probabilistic_serial(data).expected_assignment
    structure = build_constraint_structure(data)
    expected = {
        tuple(tuple(row) for row in term.assignment): term.weight
        for term in decompose(matrix, structure)
    }

    rng = random.Random(20260904)
    trials = 2000
    counts: dict[tuple[tuple[int, ...], ...], int] = {}
    for _ in range(trials):
        drawn = sample_pure_assignment(matrix, structure, rng)
        key = tuple(tuple(row) for row in drawn)
        counts[key] = counts.get(key, 0) + 1

    assert set(counts) == set(expected)
    for key, weight in expected.items():
        assert abs(counts[key] / trials - float(weight)) < 0.05


def test_sampling_is_reproducible_with_the_same_seed() -> None:
    """同じシードなら同じ純割当が得られる。"""
    data = AssignmentInput(agent_prefs=[[1, 2], [1, 2], [2, 1], [2, 1]], capacities=[1, 1])
    matrix = probabilistic_serial(data).expected_assignment
    structure = build_constraint_structure(data)

    first = sample_pure_assignment(matrix, structure, random.Random(7))
    second = sample_pure_assignment(matrix, structure, random.Random(7))

    assert first == second


def test_sampled_assignment_satisfies_all_constraints() -> None:
    """抽選結果は受け入れ人数と追加制約を満たす。"""
    data = AssignmentInput(
        agent_prefs=[[1, 2], [1, 2], [1, 2], [2, 1]],
        capacities=[2, 2],
        constraints=[UpperConstraint(cells=frozenset({(0, 0), (1, 0)}), upper=1, label="NG ペア")],
    )
    matrix = probabilistic_serial(data).expected_assignment
    structure = build_constraint_structure(data)

    drawn = sample_pure_assignment(matrix, structure, random.Random(1))

    pure = [[Fraction(value) for value in row] for row in drawn]
    assert quota_violations(pure, structure) == []
    assert drawn[0][0] + drawn[1][0] <= 1


def test_full_enumeration_is_skipped_when_too_many_fractional_cells() -> None:
    """分数の成分が多い入力では全列挙を試みずに打ち切る（抽選は成立する）。"""
    size = 12
    data = AssignmentInput(
        agent_prefs=[list(range(1, 5)) for _ in range(size)],
        capacities=[3, 3, 3, 3],
    )
    matrix = probabilistic_serial(data).expected_assignment
    structure = build_constraint_structure(data)

    with pytest.raises(LotteryTooLargeError):
        decompose(matrix, structure)

    drawn = sample_pure_assignment(matrix, structure, random.Random(3))
    assert quota_violations([[Fraction(v) for v in row] for row in drawn], structure) == []
