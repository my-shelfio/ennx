"""マッチング入力の組み立てと性質レポート生成。

入力モデルの組み立て・制約種別ディスパッチ・性質レポートを担う。

RunMatching / ValidateInput の両ユースケースが共用する。検証は次の二段構え:
    1. 構造検証（本モジュール）: 制約種別の有効性・必須フィールドの有無を
       フィールド名付き FieldError で返す
    2. ドメイン検証: 入力モデルの `__post_init__`（ValueError）を
       InvalidMatchingInputError へ変換する
"""

from __future__ import annotations

from features.matching.application.constraints import get_constraint_spec, is_valid_constraint
from features.matching.application.dto.requests import MatchingRequest
from features.matching.application.errors import InvalidMatchingInputError
from features.matching.application.meta import (
    CONSTRAINT_TYPE_KEYS,
    algorithm_for_constraint_type,
    is_valid_constraint_type,
)
from features.matching.domain import checks
from features.matching.domain.ca import all_constraints, capacity_constraint, cutoff_adjustment
from features.matching.domain.da import deferred_acceptance
from features.matching.domain.fda import flexible_deferred_acceptance
from features.matching.domain.models import CAInput, Constraint, DAInput, FDAInput, MatchingResult
from shared.application.errors import FieldError
from shared.domain.report import ReportItem

# FDA（regional_cap）で必須となるフィールド名。
_FDA_REQUIRED_FIELDS = ("max_caps", "regions", "regional_caps")


def resolve_names(request: MatchingRequest) -> tuple[list[str], list[str]]:
    """社員・部署の表示名を確定する（省略時は「社員1」「部署1」〜を自動生成）。"""
    emp_names = request.employee_names or [f"社員{i + 1}" for i in range(request.num_employees)]
    dep_names = request.department_names or [f"部署{j + 1}" for j in range(request.num_departments)]
    return emp_names, dep_names


def display_names(data: DAInput | FDAInput | CAInput) -> tuple[list[str], list[str]]:
    """`build_domain_input` が設定した社員・部署の表示名を取り出す。"""
    assert data.proposer_names is not None and data.receiver_names is not None
    return data.proposer_names, data.receiver_names


def validate_structure(request: MatchingRequest) -> list[FieldError]:
    """ドメインモデル構築前の構造検証（フィールド名付きエラーを返す）。"""
    errors: list[FieldError] = []
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
    algorithm = algorithm_for_constraint_type(request.constraint_type)
    if algorithm == "fda":
        for name in _FDA_REQUIRED_FIELDS:
            if getattr(request, name) is None:
                errors.append(
                    FieldError(
                        field=name,
                        message=f"制約種別 regional_cap では {name} の指定が必要です",
                    )
                )
    if algorithm == "ca":
        for i, entry in enumerate(request.constraints or []):
            field = f"constraints[{i}]"
            if not is_valid_constraint(entry.type):
                errors.append(
                    FieldError(
                        field=field,
                        message=f"制約「{entry.type}」は指定できません",
                    )
                )
                continue
            spec = get_constraint_spec(entry.type)
            errors.extend(spec.validate_params(entry.params, request.num_employees, field))
    return errors


def build_ca_constraints(request: MatchingRequest) -> list[Constraint]:
    """CA の部署ごとの Constraint を、定員 + 制約レジストリの登録内容から組み立てる。

    新しい上限制約は制約レジストリ（application/constraints.py）へ 1 箇所登録する
    だけでよく、本関数を個別に修正する必要はない。
    """
    capacities = request.capacities
    num_departments = len(capacities)
    per_department: list[list[Constraint]] = [[capacity_constraint(cap)] for cap in capacities]
    for entry in request.constraints or []:
        spec = get_constraint_spec(entry.type)
        extra = spec.build_constraints(entry.params, num_departments)
        for j in range(num_departments):
            per_department[j].append(extra[j])
    return [all_constraints(fns) for fns in per_department]


def build_domain_input(request: MatchingRequest) -> DAInput | FDAInput | CAInput:
    """リクエストから各アルゴリズムの入力モデルを組み立てる。

    Raises:
        InvalidMatchingInputError: 構造検証エラー、またはドメインモデルの
            `__post_init__` が送出した ValueError。
    """
    errors = validate_structure(request)
    if errors:
        raise InvalidMatchingInputError(errors)

    algorithm = algorithm_for_constraint_type(request.constraint_type)
    emp_names, dep_names = resolve_names(request)
    try:
        if algorithm == "fda":
            assert request.max_caps is not None
            assert request.regions is not None
            assert request.regional_caps is not None
            return FDAInput(
                capacities=request.capacities,
                max_caps=request.max_caps,
                regions=request.regions,
                regional_caps=request.regional_caps,
                nomination_order=list(range(request.num_departments)),
                proposer_prefs=request.proposer_prefs,
                receiver_prefs=request.receiver_prefs,
                proposer_names=emp_names,
                receiver_names=dep_names,
            )
        if algorithm == "ca":
            return CAInput(
                constraints=build_ca_constraints(request),
                proposer_prefs=request.proposer_prefs,
                receiver_prefs=request.receiver_prefs,
                proposer_names=emp_names,
                receiver_names=dep_names,
            )
        return DAInput(
            capacities=request.capacities,
            proposer_prefs=request.proposer_prefs,
            receiver_prefs=request.receiver_prefs,
            proposer_names=emp_names,
            receiver_names=dep_names,
        )
    except ValueError as exc:
        raise InvalidMatchingInputError([FieldError(field=None, message=str(exc))]) from exc


def execute_algorithm(
    algorithm: str, matching_input: DAInput | FDAInput | CAInput
) -> MatchingResult:
    """アルゴリズム種別に応じて対応するドメインの純粋関数を実行する。"""
    if algorithm == "fda":
        assert isinstance(matching_input, FDAInput)
        return flexible_deferred_acceptance(matching_input)
    if algorithm == "ca":
        assert isinstance(matching_input, CAInput)
        return cutoff_adjustment(matching_input)
    assert isinstance(matching_input, DAInput)
    return deferred_acceptance(matching_input)


def _status_item(label: str, check: checks.CheckResult, ok_detail: str) -> ReportItem:
    if check.passed:
        return ReportItem(label=label, status="ok", detail=ok_detail)
    return ReportItem(
        label=label,
        status="ng",
        detail="／".join(check.violations),
        blocking_pairs=check.blocking_pairs,
    )


def build_report(
    request: MatchingRequest,
    matching_input: DAInput | FDAInput | CAInput,
    result: MatchingResult,
) -> list[ReportItem]:
    """入力モデルの種別に応じた性質レポートを組み立てる。

    `request` は CA の追加制約（制約種別ごとのレポート項目）にのみ使う。
    """
    emp_names, dep_names = display_names(matching_input)
    pp = matching_input.proposer_prefs
    rp = matching_input.receiver_prefs
    pm = result.proposer_match
    rm = result.receiver_match
    items: list[ReportItem] = []

    # FDAInput は DAInput の派生なので、FDA を先に判定する。
    if isinstance(matching_input, FDAInput):
        max_caps = matching_input.max_caps
        regions = matching_input.regions
        regional_caps = matching_input.regional_caps
        weak = checks.check_weak_stability(pp, rp, pm, rm, max_caps, emp_names, dep_names)
        items.append(_status_item("弱安定性", weak, "弱安定なマッチングです。"))
        cap = checks.check_capacity_compliance(rm, max_caps, dep_names)
        items.append(_status_item("設置上限の遵守", cap, "すべての部署が設置上限以内です。"))
        # 地域上限の充足。
        region_assigned = [0] * len(regional_caps)
        for j, region in enumerate(regions):
            region_assigned[region] += len(rm[j])
        violations = [
            f"地域{k + 1}: 配属 {region_assigned[k]} 人 > 上限 {regional_caps[k]} 人"
            for k in range(len(regional_caps))
            if region_assigned[k] > regional_caps[k]
        ]
        if violations:
            items.append(
                ReportItem(label="地域上限の充足", status="ng", detail="／".join(violations))
            )
        else:
            detail = "、".join(
                f"地域{k + 1} {region_assigned[k]}/{regional_caps[k]}"
                for k in range(len(regional_caps))
            )
            items.append(
                ReportItem(
                    label="地域上限の充足",
                    status="ok",
                    detail=f"各地域が上限以内です（{detail}）。",
                )
            )
    elif isinstance(matching_input, CAInput):
        constraints = matching_input.constraints
        ng = [
            dep_names[j] for j, matched in enumerate(rm) if not constraints[j](frozenset(matched))
        ]
        if ng:
            items.append(
                ReportItem(label="制約の充足", status="ng", detail="制約違反: " + "、".join(ng))
            )
        else:
            items.append(
                ReportItem(
                    label="制約の充足",
                    status="ok",
                    detail="すべての部署が制約（定員含む）を満たします。",
                )
            )
        for entry in request.constraints or []:
            spec = get_constraint_spec(entry.type)
            items.append(spec.build_report_item(entry.params, rm, emp_names, dep_names))
        fairness = checks.check_fairness(pp, rp, pm, rm, emp_names, dep_names)
        items.append(_status_item("公平性", fairness, "公平なマッチングです（正当な羨望なし）。"))
    else:
        stability = checks.check_stability(
            pp, rp, pm, rm, matching_input.capacities, emp_names, dep_names
        )
        items.append(
            _status_item("安定性", stability, "安定なマッチングです（ブロッキングペアは 0 件）。")
        )
        cap = checks.check_capacity_compliance(rm, matching_input.capacities, dep_names)
        items.append(_status_item("定員遵守", cap, "すべての部署が定員以内です。"))

    return items
