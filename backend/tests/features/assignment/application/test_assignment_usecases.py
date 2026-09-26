"""assignment ユースケースのテスト（入力検証・ディスパッチ・性質レポート）。"""

from __future__ import annotations

from fractions import Fraction
from typing import Any

import pytest

from features.assignment.application.dto.requests import AssignmentRequest, ConstraintEntry
from features.assignment.application.errors import InvalidAssignmentInputError
from features.assignment.application.usecases import (
    GetAssignmentConstraintMeta,
    GetAssignmentSample,
    GetUpperConstraintMeta,
    RunAssignment,
    ValidateAssignmentInput,
)
from features.assignment.domain import MAX_AGENTS


def _request(**overrides: Any) -> AssignmentRequest:
    """既定の有効なリクエストを部分的に上書きして作る。"""
    base: dict[str, Any] = {
        "constraint_type": "capacity_only",
        "capacities": [1, 1],
        "agent_prefs": [[1, 2], [1, 2], [2, 1], [2, 1]],
    }
    base.update(overrides)
    return AssignmentRequest(**base)


def test_run_returns_expected_assignment_and_lottery() -> None:
    """期待割当とくじが返り、くじの重みの総和は 1 になる。"""
    outcome = RunAssignment().execute(_request())

    assert outcome.mechanism == "ps"
    assert outcome.expected_assignment[0] == ["1/2", "0", "1/2"]
    assert sum((Fraction(term.weight) for term in outcome.lottery), Fraction(0)) == 1
    for term in outcome.lottery:
        assert len(term.assignment) == 4


def test_run_generates_default_names() -> None:
    """表示名を省略すると「社員1」「部署1」〜が自動生成される。"""
    outcome = RunAssignment().execute(_request())

    assert outcome.employee_names == ["社員1", "社員2", "社員3", "社員4"]
    assert outcome.department_names == ["部署1", "部署2"]


def test_report_marks_strategy_proofness_as_not_guaranteed() -> None:
    """性質レポートに「耐戦略性は保証しない」旨の info 項目が含まれる。"""
    outcome = RunAssignment().execute(_request())

    labels = {item.label: item for item in outcome.report}
    assert labels["順序効率性"].status == "ok"
    assert labels["無羨望性"].status == "ok"
    assert labels["水平性"].status == "ok"
    assert labels["耐戦略性"].status == "info"
    assert "保証しません" in labels["耐戦略性"].detail


def test_ng_pair_constraint_is_respected_in_every_lottery_term() -> None:
    """NG ペアはくじのどの項でも同じ部署に同居しない。"""
    outcome = RunAssignment().execute(
        _request(
            constraint_type="general",
            capacities=[2, 2],
            agent_prefs=[[1, 2], [1, 2], [1, 2], [2, 1]],
            constraints=[ConstraintEntry(type="ng_pair", params={"pairs": [[0, 1]]})],
        )
    )

    for term in outcome.lottery:
        assert not (term.assignment[0] == term.assignment[1] == 0)


def test_crossing_constraints_are_rejected_before_execution() -> None:
    """交差する NG ペア（鎖状の指定）は分解できないため実行前に弾かれる。"""
    request = _request(
        constraint_type="general",
        capacities=[2, 2],
        agent_prefs=[[1, 2], [1, 2], [1, 2], [2, 1]],
        constraints=[ConstraintEntry(type="ng_pair", params={"pairs": [[0, 1], [1, 2]]})],
    )

    with pytest.raises(InvalidAssignmentInputError) as exc_info:
        RunAssignment().execute(request)

    assert any("分解できません" in error.message for error in exc_info.value.errors)


def test_constraints_require_general_constraint_type() -> None:
    """capacity_only では追加制約を指定できない。"""
    request = _request(constraints=[ConstraintEntry(type="ng_pair", params={"pairs": [[0, 1]]})])

    with pytest.raises(InvalidAssignmentInputError):
        RunAssignment().execute(request)


@pytest.mark.parametrize(
    ("request_kwargs", "expected_field"),
    [
        ({"constraint_type": "unknown"}, "constraint_type"),
        (
            {
                "constraint_type": "general",
                "constraints": [ConstraintEntry(type="unknown", params={})],
            },
            "constraints[0]",
        ),
        (
            {
                "constraint_type": "general",
                "constraints": [ConstraintEntry(type="ng_pair", params={"pairs": [[0, 9]]})],
            },
            "constraints[0]",
        ),
    ],
)
def test_validate_reports_field_errors(request_kwargs: dict[str, Any], expected_field: str) -> None:
    """検証エラーはフィールド名つきで返る（例外ではなく結果として返す）。"""
    outcome = ValidateAssignmentInput().execute(_request(**request_kwargs))

    assert not outcome.valid
    assert [e.field for e in outcome.errors] == [expected_field]


def test_validate_accepts_valid_input() -> None:
    """妥当な入力は valid=True で返る。"""
    outcome = ValidateAssignmentInput().execute(_request())

    assert outcome.valid
    assert outcome.errors == []


def test_sample_input_runs_successfully() -> None:
    """サンプル入力はそのまま実行できる。"""
    sample = GetAssignmentSample().execute()

    outcome = RunAssignment().execute(sample)

    assert outcome.employee_names == ["佐藤", "鈴木", "高橋", "田中", "伊藤"]
    assert outcome.lottery


def test_meta_lists_constraint_types_and_upper_constraints() -> None:
    """メタ情報に制約種別と追加制約種別が含まれる。"""
    constraint_types = GetAssignmentConstraintMeta().execute()
    upper_constraints = GetUpperConstraintMeta().execute()

    assert [meta.key for meta in constraint_types] == ["capacity_only", "general"]
    assert all(meta.mechanism.key == "ps" for meta in constraint_types)
    assert [meta.key for meta in upper_constraints] == ["ng_pair", "group_quota"]


def test_run_returns_a_reproducible_drawn_assignment() -> None:
    """抽選結果は返され、同じシードなら再現できる。"""
    first = RunAssignment().execute(_request(seed=123))
    second = RunAssignment().execute(_request(seed=123))

    assert first.drawn_assignment == second.drawn_assignment
    assert first.seed == 123
    assert len(first.drawn_assignment) == 4
    assert all(-1 <= department <= 1 for department in first.drawn_assignment)


def test_run_generates_a_seed_when_omitted() -> None:
    """シードを省略してもレスポンスには実際に使ったシードが入る。"""
    outcome = RunAssignment().execute(_request())

    assert outcome.seed >= 0
    assert RunAssignment().execute(_request(seed=outcome.seed)).drawn_assignment == (
        outcome.drawn_assignment
    )


def test_drawn_assignment_respects_capacities() -> None:
    """抽選結果は受け入れ人数を超えない。"""
    outcome = RunAssignment().execute(_request())

    for department, capacity in enumerate(outcome.capacities):
        assert outcome.drawn_assignment.count(department) <= capacity


def test_large_input_returns_a_draw_without_the_full_lottery() -> None:
    """全列挙できない規模でも、抽選結果は返る（エラーにしない）。"""
    outcome = RunAssignment().execute(
        _request(capacities=[3, 3, 3, 3], agent_prefs=[[1, 2, 3, 4] for _ in range(12)])
    )

    assert outcome.lottery_complete is False
    assert outcome.lottery == []
    assert len(outcome.drawn_assignment) == 12
    detail = next(item.detail for item in outcome.report if item.label == "くじへの分解")
    assert "省略" in detail


def test_input_over_the_size_limit_is_rejected() -> None:
    """入力規模の上限を超えると検証エラーになる。

    上限値そのものは性能実測に応じて変わるため、定数から 1 人だけ超えた入力を作る。
    """
    over_limit = [[1, 2] for _ in range(MAX_AGENTS + 1)]

    outcome = ValidateAssignmentInput().execute(_request(agent_prefs=over_limit))

    assert not outcome.valid
    assert any("上限" in error.message for error in outcome.errors)
