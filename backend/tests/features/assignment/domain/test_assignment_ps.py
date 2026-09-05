"""PS メカニズムのフィクスチャテスト。

期待値は移植元の実行例（『マッチング理論とマーケットデザイン』第 7・9 章の
サンプルコード）を実行して確定した値であり、変更には理論照合による根拠を要する。
"""

from __future__ import annotations

from fractions import Fraction

import pytest

from features.assignment.domain import (
    AssignmentInput,
    UpperConstraint,
    probabilistic_serial,
    reconstruct_expected_assignment,
)


def _fractions(rows: list[list[str]]) -> list[list[Fraction]]:
    """分数文字列の表から Fraction の行列を作る。"""
    return [[Fraction(cell) for cell in row] for row in rows]


def test_ps_example1_two_goods() -> None:
    """例1: 社員 4 人・対象 2 件（供給数 1 ずつ）。上位 2 人ずつで半々に分け合う。"""
    data = AssignmentInput(agent_prefs=[[1, 2], [1, 2], [2, 1], [2, 1]], capacities=[1, 1])

    result = probabilistic_serial(data)

    assert result.expected_assignment == _fractions(
        [
            ["1/2", "0", "1/2"],
            ["1/2", "0", "1/2"],
            ["0", "1/2", "1/2"],
            ["0", "1/2", "1/2"],
        ]
    )


def test_ps_example2_partial_preference_lists() -> None:
    """例2: 部分リスト（受け入れ不可能な対象がある）ケース。"""
    data = AssignmentInput(agent_prefs=[[1, 2], [1], [2], [2]], capacities=[1, 1])

    result = probabilistic_serial(data)

    assert result.expected_assignment == _fractions(
        [
            ["1/2", "0", "1/2"],
            ["1/2", "0", "1/2"],
            ["0", "1/2", "1/2"],
            ["0", "1/2", "1/2"],
        ]
    )


def test_ps_example3_eight_agents_four_objects() -> None:
    """例3: 社員 8 人・対象 4 件（うち 1 件は供給数 3）。厳密な分数計算を確認する。"""
    data = AssignmentInput(
        agent_prefs=[
            [2, 3, 4, 1],
            [4, 2, 1, 3],
            [2, 1, 4, 3],
            [2, 4, 3, 1],
            [1, 2, 3, 4],
            [1, 2, 4, 3],
            [2, 4, 1, 3],
            [1, 4, 2, 3],
        ],
        capacities=[1, 1, 1, 3],
    )

    result = probabilistic_serial(data)

    assert result.expected_assignment == _fractions(
        [
            ["0", "1/4", "1/2", "0", "1/4"],
            ["0", "0", "1/96", "71/96", "1/4"],
            ["1/16", "1/4", "1/96", "41/96", "1/4"],
            ["0", "1/4", "1/96", "47/96", "1/4"],
            ["5/16", "0", "7/16", "0", "1/4"],
            ["5/16", "0", "1/96", "41/96", "1/4"],
            ["0", "1/4", "1/96", "47/96", "1/4"],
            ["5/16", "0", "1/96", "41/96", "1/4"],
        ]
    )


def test_extended_ps_multi_capacity() -> None:
    """拡張PS 実行例1: 1 案件に複数人（上限制約なし。素の PS と一致する）。"""
    data = AssignmentInput(
        agent_prefs=[[1, 2, 3], [1, 2, 3], [1, 3, 2], [1, 2, 3], [2, 1, 3], [3, 2, 1]],
        capacities=[3, 2, 1],
    )

    result = probabilistic_serial(data)

    assert result.expected_assignment == _fractions(
        [
            ["3/4", "1/4", "0", "0"],
            ["3/4", "1/4", "0", "0"],
            ["3/4", "1/8", "1/8", "0"],
            ["3/4", "1/4", "0", "0"],
            ["0", "1", "0", "0"],
            ["0", "1/8", "7/8", "0"],
        ]
    )


def test_extended_ps_forbidden_pair() -> None:
    """拡張PS 実行例2: NG ペア（社員 2・3）を同じ案件に入れない上限制約。"""
    data = AssignmentInput(
        agent_prefs=[[1, 2, 3], [1, 2, 3], [1, 2, 3], [2, 1, 3], [2, 3, 1]],
        capacities=[2, 2, 1],
        constraints=[
            UpperConstraint(
                cells=frozenset({(1, j), (2, j)}), upper=1, label=f"NG ペア（対象 {j}）"
            )
            for j in range(3)
        ],
    )

    result = probabilistic_serial(data)

    assert result.expected_assignment == _fractions(
        [
            ["7/8", "0", "1/8", "0"],
            ["1/2", "1/4", "1/4", "0"],
            ["1/2", "1/4", "1/4", "0"],
            ["1/8", "3/4", "1/8", "0"],
            ["0", "3/4", "1/4", "0"],
        ]
    )


def test_extended_ps_group_quota() -> None:
    """拡張PS 実行例3: 若手だけで案件を埋めない（グループ別クォータ）。"""
    juniors = [1, 2, 4]
    data = AssignmentInput(
        agent_prefs=[[1, 2], [1, 2], [1, 2], [2, 1], [1, 2], [2, 1]],
        capacities=[2, 2],
        constraints=[
            UpperConstraint(
                cells=frozenset({(i, j) for i in juniors}),
                upper=1,
                label=f"若手クォータ（対象 {j}）",
            )
            for j in range(2)
        ],
    )

    result = probabilistic_serial(data)

    assert result.expected_assignment == _fractions(
        [
            ["11/15", "0", "4/15"],
            ["1/3", "4/15", "2/5"],
            ["1/3", "4/15", "2/5"],
            ["2/15", "3/5", "4/15"],
            ["1/3", "4/15", "2/5"],
            ["2/15", "3/5", "4/15"],
        ]
    )


def test_events_reconstruct_expected_assignment() -> None:
    """イベントログだけから期待割当行列を再構成できる。"""
    data = AssignmentInput(
        agent_prefs=[[1, 2], [1, 2], [2, 1], [2, 1]],
        capacities=[2, 1],
        constraints=[
            UpperConstraint(cells=frozenset({(0, 0), (1, 0), (2, 0)}), upper=1, label="上限 1")
        ],
    )

    result = probabilistic_serial(data)

    assert (
        reconstruct_expected_assignment(result.events, data.n_agents, data.n_objects)
        == result.expected_assignment
    )


def test_events_record_supply_exhaustion_and_saturation() -> None:
    """供給の枯渇と上限制約の飽和がイベントとして記録される。"""
    data = AssignmentInput(
        agent_prefs=[[1, 2], [1, 2], [2, 1], [2, 1]],
        capacities=[2, 1],
        constraints=[
            UpperConstraint(cells=frozenset({(0, 0), (1, 0), (2, 0)}), upper=1, label="上限 1")
        ],
    )

    events = probabilistic_serial(data).events
    kinds = {event.event_type.value for event in events}

    assert "consume" in kinds
    assert "supply_exhausted" in kinds
    assert "constraint_saturated" in kinds


def test_row_sums_are_one() -> None:
    """各社員の期待割当は ∅ を含めて合計 1 になる。"""
    data = AssignmentInput(agent_prefs=[[1, 2], [2], [1]], capacities=[1, 1])

    result = probabilistic_serial(data)

    for row in result.expected_assignment:
        assert sum(row, Fraction(0)) == 1


@pytest.mark.parametrize(
    ("kwargs", "message"),
    [
        ({"agent_prefs": [[3]], "capacities": [1]}, "範囲外の対象番号"),
        ({"agent_prefs": [[1, 1]], "capacities": [1]}, "重複"),
        ({"agent_prefs": [[1]], "capacities": [-1]}, "供給数が負"),
        ({"agent_prefs": [], "capacities": [1]}, "社員が 1 人もいません"),
        ({"agent_prefs": [[1]], "capacities": []}, "対象（部署・案件）が 1 つもありません"),
    ],
)
def test_input_validation(kwargs: dict[str, object], message: str) -> None:
    """理論的前提・入力形式の違反は ValueError になる。"""
    with pytest.raises(ValueError, match=message):
        AssignmentInput(**kwargs)  # type: ignore[arg-type]


def test_constraint_cannot_target_empty_column() -> None:
    """∅ 列を対象にした上限制約は受け付けない。"""
    with pytest.raises(ValueError, match="範囲外の対象"):
        AssignmentInput(
            agent_prefs=[[1]],
            capacities=[1],
            constraints=[UpperConstraint(cells=frozenset({(0, 1)}), upper=1)],
        )
