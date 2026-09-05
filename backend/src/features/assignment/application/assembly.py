"""割り当て入力の組み立て・実行・性質レポート生成。

RunAssignment / ValidateAssignmentInput の両ユースケースが共用する。検証は
三段構え:
    1. 構造検証: 制約種別の有効性・パラメータの形式をフィールド名付きで返す
    2. ドメイン検証: 入力モデルの `__post_init__`（ValueError）を変換する
    3. 分解可能性の検証: 制約構造が bihierarchy でなければ実行前に弾く
       （交差する制約の下では期待割当をくじに分解できないため）
"""

from __future__ import annotations

from fractions import Fraction

from features.assignment.application.constraints import get_constraint_spec, is_valid_constraint
from features.assignment.application.dto.requests import AssignmentRequest
from features.assignment.application.errors import InvalidAssignmentInputError
from features.assignment.application.meta import (
    CONSTRAINT_TYPE_KEYS,
    allows_extra_constraints,
    is_valid_constraint_type,
)
from features.assignment.domain import checks
from features.assignment.domain.constraints import build_constraint_structure
from features.assignment.domain.lottery import DecompositionError, decompose, ensure_decomposable
from features.assignment.domain.models import (
    AssignmentInput,
    AssignmentResult,
    LotteryResult,
    UpperConstraint,
)
from features.assignment.domain.ps import probabilistic_serial
from shared.application.errors import FieldError
from shared.domain.report import ReportItem


def resolve_names(request: AssignmentRequest) -> tuple[list[str], list[str]]:
    """社員・部署の表示名を確定する（省略時は「社員1」「部署1」〜を自動生成）。"""
    emp_names = request.employee_names or [f"社員{i + 1}" for i in range(request.num_employees)]
    dep_names = request.department_names or [f"部署{j + 1}" for j in range(request.num_departments)]
    return emp_names, dep_names


def validate_structure(request: AssignmentRequest) -> list[FieldError]:
    """ドメインモデル構築前の構造検証（フィールド名付きエラーを返す）。"""
    if not is_valid_constraint_type(request.constraint_type):
        return [
            FieldError(
                field="constraint_type",
                message=(
                    f"制約種別「{request.constraint_type}」は指定できません"
                    f"（{' / '.join(CONSTRAINT_TYPE_KEYS)} から選択してください）"
                ),
            )
        ]

    errors: list[FieldError] = []
    entries = request.constraints or []
    if entries and not allows_extra_constraints(request.constraint_type):
        errors.append(
            FieldError(
                field="constraints",
                message="追加の制約は制約種別 general でのみ指定できます",
            )
        )
        return errors

    for index, entry in enumerate(entries):
        field = f"constraints[{index}]"
        if not is_valid_constraint(entry.type):
            errors.append(FieldError(field=field, message=f"制約「{entry.type}」は指定できません"))
            continue
        spec = get_constraint_spec(entry.type)
        errors.extend(
            spec.validate_params(
                entry.params, request.num_employees, request.num_departments, field
            )
        )
    return errors


def build_upper_constraints(request: AssignmentRequest) -> list[UpperConstraint]:
    """追加の上限制約をドメインモデルへ変換する（構造検証済みの入力を前提とする）。"""
    _, dep_names = resolve_names(request)
    constraints: list[UpperConstraint] = []
    if not allows_extra_constraints(request.constraint_type):
        return constraints
    for entry in request.constraints or []:
        spec = get_constraint_spec(entry.type)
        constraints.extend(
            spec.build_constraints(
                entry.params, request.num_employees, request.num_departments, dep_names
            )
        )
    return constraints


def build_domain_input(request: AssignmentRequest) -> AssignmentInput:
    """リクエスト DTO からドメイン入力モデルを組み立て、分解可能性まで検証する。

    Raises:
        InvalidAssignmentInputError: 構造検証・ドメイン検証・分解可能性の検証で
            エラーが見つかった場合。
    """
    errors = validate_structure(request)
    if errors:
        raise InvalidAssignmentInputError(errors)

    emp_names, dep_names = resolve_names(request)
    try:
        data = AssignmentInput(
            agent_prefs=request.agent_prefs,
            capacities=request.capacities,
            constraints=build_upper_constraints(request),
            agent_names=emp_names,
            object_names=dep_names,
        )
    except ValueError as exc:
        raise InvalidAssignmentInputError([FieldError(field=None, message=str(exc))]) from exc

    try:
        ensure_decomposable(build_constraint_structure(data))
    except DecompositionError as exc:
        raise InvalidAssignmentInputError(
            [FieldError(field="constraints", message=str(exc))]
        ) from exc
    return data


def run_mechanism(data: AssignmentInput) -> LotteryResult:
    """PS を実行し、期待割当を確定的な配属のくじに分解する。

    Raises:
        InvalidAssignmentInputError: 入力規模が大きすぎて分解を打ち切った場合。
    """
    result = probabilistic_serial(data)
    structure = build_constraint_structure(data)
    try:
        terms = decompose(result.expected_assignment, structure)
    except DecompositionError as exc:
        raise InvalidAssignmentInputError([FieldError(field=None, message=str(exc))]) from exc
    return LotteryResult(
        expected_assignment=result.expected_assignment, events=result.events, terms=terms
    )


def _status_item(label: str, check: checks.CheckResult, ok_detail: str) -> ReportItem:
    """性質検証の結果を性質レポートの 1 項目へ変換する。"""
    if check.passed:
        return ReportItem(label=label, status="ok", detail=ok_detail)
    return ReportItem(label=label, status="ng", detail="／".join(check.violations))


def build_report(data: AssignmentInput, result: AssignmentResult) -> list[ReportItem]:
    """PS の性質レポートを組み立てる。

    保証する性質（順序効率性・無羨望性・水平性）は実際の結果に対して検証し、
    保証しない性質（耐戦略性）は info 項目として明記する。
    """
    matrix = result.expected_assignment
    items = [
        _status_item(
            "順序効率性",
            checks.check_ordinal_efficiency(data, matrix),
            "確率を融通し合っても全員が得をする配分は存在しません。",
        ),
        _status_item(
            "無羨望性",
            checks.check_envy_free(data, matrix),
            "自分の配分より他人の配分を好む社員はいません。",
        ),
        _status_item(
            "水平性",
            checks.check_equal_treatment(data, matrix),
            "同じ希望順位を出した社員は同じ確率で配分されています。",
        ),
    ]

    over = [
        f"{data.o_name(j)}: {_total(matrix, j, data.n_agents)} 人 > "
        f"受け入れ {data.capacities[j]} 人"
        for j in range(data.n_objects)
        if _total(matrix, j, data.n_agents) > data.capacities[j]
    ]
    if over:
        items.append(ReportItem(label="受け入れ人数の遵守", status="ng", detail="／".join(over)))
    else:
        items.append(
            ReportItem(
                label="受け入れ人数の遵守",
                status="ok",
                detail="すべての部署が受け入れ人数以内です。",
            )
        )

    if data.constraints:
        violated = [
            constraint.display_label()
            for constraint in data.constraints
            if sum((matrix[i][j] for (i, j) in constraint.cells), Fraction(0)) > constraint.upper
        ]
        if violated:
            items.append(
                ReportItem(
                    label="追加制約の充足", status="ng", detail="制約違反: " + "、".join(violated)
                )
            )
        else:
            items.append(
                ReportItem(
                    label="追加制約の充足",
                    status="ok",
                    detail=f"指定した {len(data.constraints)} 件の制約をすべて満たしています。",
                )
            )

    if isinstance(result, LotteryResult):
        items.append(
            ReportItem(
                label="くじへの分解",
                status="ok",
                detail=(
                    f"期待割当を {len(result.terms)} 通りの確定的な配属に分解しました。"
                    "どの配属を引いても受け入れ人数と追加制約を満たします。"
                ),
            )
        )

    items.append(
        ReportItem(
            label="耐戦略性",
            status="info",
            detail=(
                "PS は耐戦略性を保証しません。希望順位を偽ることで得をする社員が"
                "存在しうるため、申告内容の扱いには注意してください。"
            ),
        )
    )
    return items


def _total(matrix: list[list[Fraction]], column: int, n_agents: int) -> Fraction:
    """期待割当行列の列合計（配属される人数の期待値）を返す。"""
    return sum((matrix[i][column] for i in range(n_agents)), Fraction(0))
