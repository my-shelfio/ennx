"""追加の上限制約の application 層レジストリ。

新しい制約種別を追加する手順:
    1. validate_params / build_constraints を実装する
    2. `UpperConstraintSpec` を組み立て、`UPPER_CONSTRAINT_SPECS` に追加する

制約は domain 層の前提どおり上限制約に限る（下限制約は対象外）。さらに、
制約構造が bihierarchy を保つかどうかは組み合わせ次第で決まるため、
実行前に domain 層の `ensure_decomposable` で必ず検証する
（例: NG ペアを鎖状に指定すると制約集合が交差し、くじに分解できなくなる）。
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from features.assignment.application.dto.results import (
    ConstraintFieldMetaDTO,
    UpperConstraintMetaDTO,
)
from features.assignment.domain.models import UpperConstraint
from shared.application.errors import FieldError


@dataclass(frozen=True, kw_only=True)
class ConstraintFieldSpec:
    """追加制約 1 パラメータフィールドのメタ情報（動的フォーム生成用）。

    Attributes:
        name: params 辞書内のキー名。
        label: フォームに表示するラベル。
        field_type: 入力方式を表す種別キー。
        help_text: 入力欄の補足説明（任意）。
    """

    name: str
    label: str
    field_type: str
    help_text: str | None = None


@dataclass(frozen=True, kw_only=True)
class UpperConstraintSpec:
    """追加の上限制約種別の宣言的定義。

    Attributes:
        constraint_type: `ConstraintEntry.type` に対応する種別キー。
        label: 画面・レポートでの表示名。
        validate_params: params を検証し、エラーの列を返す（正常時は空リスト）。
        build_constraints: params から domain 層の上限制約を生成する。
        fields: パラメータのフィールド定義（動的フォーム生成用、登録順）。
    """

    constraint_type: str
    label: str
    validate_params: Callable[[dict[str, Any], int, int, str], list[FieldError]]
    build_constraints: Callable[[dict[str, Any], int, int, list[str]], list[UpperConstraint]]
    fields: tuple[ConstraintFieldSpec, ...] = ()


def _is_index(value: Any, limit: int) -> bool:
    """value が 0 以上 limit 未満の整数か（bool は除外）。"""
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value < limit


def _ng_pair_validate(
    params: dict[str, Any], num_employees: int, _num_departments: int, field: str
) -> list[FieldError]:
    """NG ペアの params（{"pairs": [[a, b], ...]}、0-indexed）を検証する。"""
    pairs = params.get("pairs") or []
    if not isinstance(pairs, list):
        return [FieldError(field=field, message="pairs はペアのリストで指定してください")]
    errors: list[FieldError] = []
    for pair in pairs:
        if not isinstance(pair, list | tuple) or len(pair) != 2:
            errors.append(
                FieldError(field=field, message="NG ペアは社員 2 人の組で指定してください")
            )
            continue
        if not all(_is_index(x, num_employees) for x in pair):
            errors.append(
                FieldError(field=field, message=f"NG ペアの社員番号は 0〜{num_employees - 1} です")
            )
            continue
        if pair[0] == pair[1]:
            errors.append(FieldError(field=field, message="NG ペアに同じ社員は指定できません"))
    return errors


def _ng_pair_build(
    params: dict[str, Any],
    _num_employees: int,
    num_departments: int,
    department_names: list[str],
) -> list[UpperConstraint]:
    """NG ペアを「各部署でその 2 人の合計 ≤ 1」の上限制約に変換する。"""
    pairs = params.get("pairs") or []
    constraints: list[UpperConstraint] = []
    for pair in pairs:
        left, right = int(pair[0]), int(pair[1])
        who = f"社員{left + 1}と社員{right + 1}"
        for j in range(num_departments):
            constraints.append(
                UpperConstraint(
                    cells=frozenset({(left, j), (right, j)}),
                    upper=1,
                    label=f"{department_names[j]}に{who}を同時に配属しない",
                )
            )
    return constraints


def _group_quota_validate(
    params: dict[str, Any], num_employees: int, num_departments: int, field: str
) -> list[FieldError]:
    """グループ別人数上限の params を検証する。

    params の形式: {"members": [社員 0-index, ...], "department": 部署 0-index,
    "upper": 上限人数}
    """
    errors: list[FieldError] = []
    members = params.get("members")
    if not isinstance(members, list) or not members:
        errors.append(
            FieldError(field=field, message="members は社員番号のリストで指定してください")
        )
    elif not all(_is_index(m, num_employees) for m in members):
        errors.append(
            FieldError(field=field, message=f"members の社員番号は 0〜{num_employees - 1} です")
        )
    elif len(set(members)) != len(members):
        errors.append(FieldError(field=field, message="members に同じ社員を重複して指定できません"))

    department = params.get("department")
    if not _is_index(department, num_departments):
        errors.append(
            FieldError(
                field=field,
                message=f"department は 0〜{num_departments - 1} で指定してください",
            )
        )

    upper = params.get("upper")
    if not isinstance(upper, int) or isinstance(upper, bool) or upper < 0:
        errors.append(FieldError(field=field, message="upper は 0 以上の整数で指定してください"))
    return errors


def _group_quota_build(
    params: dict[str, Any],
    _num_employees: int,
    _num_departments: int,
    department_names: list[str],
) -> list[UpperConstraint]:
    """グループ別人数上限を上限制約に変換する。"""
    members = [int(m) for m in params["members"]]
    department = int(params["department"])
    upper = int(params["upper"])
    return [
        UpperConstraint(
            cells=frozenset({(i, department) for i in members}),
            upper=upper,
            label=f"{department_names[department]}の対象グループは最大{upper}人",
        )
    ]


UPPER_CONSTRAINT_SPECS: dict[str, UpperConstraintSpec] = {
    "ng_pair": UpperConstraintSpec(
        constraint_type="ng_pair",
        label="NG ペア（同じ部署に配属しない社員の組）",
        validate_params=_ng_pair_validate,
        build_constraints=_ng_pair_build,
        fields=(
            ConstraintFieldSpec(
                name="pairs",
                label="同じ部署に配属しない社員の組",
                field_type="employee_pair_list",
                help_text="組は何組でも登録できます。",
            ),
        ),
    ),
    "group_quota": UpperConstraintSpec(
        constraint_type="group_quota",
        label="グループ別の人数上限",
        validate_params=_group_quota_validate,
        build_constraints=_group_quota_build,
        fields=(
            ConstraintFieldSpec(
                name="members",
                label="対象の社員",
                field_type="employee_list",
                help_text="例: 経験年数の浅い社員をまとめて指定します。",
            ),
            ConstraintFieldSpec(
                name="department",
                label="対象の部署",
                field_type="department_select",
            ),
            ConstraintFieldSpec(
                name="upper",
                label="上限人数",
                field_type="integer",
                help_text="受け入れ人数より 1 少なくすると、対象グループだけで埋まるのを防げます。",
            ),
        ),
    ),
}


def is_valid_constraint(constraint_type: str) -> bool:
    """追加制約の種別キーが有効か。"""
    return constraint_type in UPPER_CONSTRAINT_SPECS


def get_constraint_spec(constraint_type: str) -> UpperConstraintSpec:
    """追加制約の種別キーから定義を取得する。"""
    return UPPER_CONSTRAINT_SPECS[constraint_type]


def upper_constraint_metas() -> list[UpperConstraintMetaDTO]:
    """全ての追加制約種別のメタ情報を登録順に返す。"""
    return [
        UpperConstraintMetaDTO(
            key=spec.constraint_type,
            label=spec.label,
            fields=[
                ConstraintFieldMetaDTO(
                    name=f.name, label=f.label, field_type=f.field_type, help_text=f.help_text
                )
                for f in spec.fields
            ],
        )
        for spec in UPPER_CONSTRAINT_SPECS.values()
    ]
