"""CA 制約の application 層レジストリ。

現 Flask 実装の src/app/matching/constraints.py から、フォーム依存
（Flask-WTF / WTForms）を除いたコア部分（パラメータ検証・Constraint 関数生成・
性質レポート項目生成）を再配置したもの。

新しい制約種別を追加する手順:
    1. validate_params / build_constraints / build_report_item を実装する
    2. `ConstraintSpec` を組み立て、`CA_CONSTRAINT_SPECS` に追加する

制約は backend/src/domain/matching/ca.py の前提どおり、遺伝性（実行可能な
集合の任意の部分集合も実行可能）を満たす上限制約に限る。
パラメータは `ConstraintEntry.params`（例: {"pairs": [[0, 1]]}、0-indexed）で受け取る。
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from features.matching.application.dto.results import CaConstraintMetaDTO, ConstraintFieldMetaDTO
from features.matching.domain.ca import collision_avoidance_constraint
from features.matching.domain.models import Constraint
from shared.application.errors import FieldError
from shared.domain.report import ReportItem


@dataclass(frozen=True, kw_only=True)
class ConstraintFieldSpec:
    """CA 制約 1 パラメータフィールドのメタ情報（動的フォーム生成用）。

    `GET /api/v1/meta/ca-constraint-types` 経由でフロントエンドへ配信する。
    フロントエンドは field_type ごとに汎用コンポーネントをディスパッチし、
    制約種別（constraint_type）ごとの個別実装は持たない。新しい制約種別が
    既存の field_type を再利用する限り、フロント側の改修は不要になる
    （制約追加はレジストリ登録 1 箇所で完結するという既存方針を UI まで延長する設計）。

    Attributes:
        name: params 辞書内のキー名。
        label: フォームに表示するラベル。
        field_type: フィールドの入力方式を表す種別キー。現状は
            "employee_pair_list"（社員×社員のペアを複数登録する入力）のみ。
        help_text: 入力欄の補足説明（任意）。
    """

    name: str
    label: str
    field_type: str
    help_text: str | None = None


@dataclass(frozen=True, kw_only=True)
class ConstraintSpec:
    """CA 制約種別の宣言的定義（application 層。アルゴリズム本体は domain/matching/ca.py）。

    Attributes:
        constraint_type: `ConstraintEntry.type` に対応する種別キー。
        label: 画面・レポートでの表示名。
        validate_params: params を検証し、エラーの列を返す（正常時は空リスト）。
            field には呼び出し元から渡されたフィールド名を設定する。
        build_constraints: params から部署ごとの Constraint 関数リストを生成する
            （部署に依存しない制約は同一関数を部署数ぶん複製して返す）。
        build_report_item: params と実際の配属結果から性質レポートの 1 項目を作る。
        fields: パラメータのフィールド定義（動的フォーム生成用、登録順）。
    """

    constraint_type: str
    label: str
    validate_params: Callable[[dict[str, Any], int, str], list[FieldError]]
    build_constraints: Callable[[dict[str, Any], int], list[Constraint]]
    build_report_item: Callable[[dict[str, Any], list[list[int]], list[str], list[str]], ReportItem]
    fields: tuple[ConstraintFieldSpec, ...] = ()


def _ng_pair_validate_params(
    params: dict[str, Any], num_employees: int, field: str
) -> list[FieldError]:
    """NG ペアの params（{"pairs": [[a, b], ...]}、0-indexed）を検証する。"""
    errors: list[FieldError] = []
    pairs = params.get("pairs") or []
    if not isinstance(pairs, list):
        return [FieldError(field=field, message="pairs はペアのリストで指定してください")]
    for pair in pairs:
        if (
            not isinstance(pair, (list, tuple))
            or len(pair) != 2
            or not all(isinstance(x, int) and not isinstance(x, bool) for x in pair)
        ):
            errors.append(
                FieldError(
                    field=field,
                    message=f"NG ペア「{pair}」の形式が不正です（0-indexed の社員番号 2 つ）",
                )
            )
            continue
        a, b = pair
        if not (0 <= a < num_employees and 0 <= b < num_employees):
            errors.append(
                FieldError(
                    field=field,
                    message=(
                        f"NG ペア「{pair}」に範囲外の社員番号があります（0〜{num_employees - 1}）"
                    ),
                )
            )
            continue
        if a == b:
            errors.append(FieldError(field=field, message=f"NG ペア「{pair}」は同一社員です"))
    return errors


def _ng_pair_build_constraints(params: dict[str, Any], num_departments: int) -> list[Constraint]:
    conflicts = [(a, b) for a, b in params.get("pairs") or []]
    constraint = collision_avoidance_constraint(conflicts)
    return [constraint for _ in range(num_departments)]


def _ng_pair_build_report_item(
    params: dict[str, Any],
    receiver_match: list[list[int]],
    emp_names: list[str],
    dep_names: list[str],
) -> ReportItem:
    pairs = params.get("pairs") or []
    if not pairs:
        return ReportItem(
            label="NG ペアの分離", status="info", detail="NG ペアの指定はありません。"
        )
    violations: list[str] = []
    for j, matched in enumerate(receiver_match):
        matched_set = set(matched)
        for a, b in pairs:
            if a in matched_set and b in matched_set:
                violations.append(f"{dep_names[j]}: {emp_names[a]}と{emp_names[b]}が同一部署")
    if violations:
        return ReportItem(label="NG ペアの分離", status="ng", detail="／".join(violations))
    return ReportItem(
        label="NG ペアの分離", status="ok", detail="NG ペアはすべて分離されています。"
    )


NG_PAIR_SPEC = ConstraintSpec(
    constraint_type="ng_pair",
    label="NG ペア",
    validate_params=_ng_pair_validate_params,
    build_constraints=_ng_pair_build_constraints,
    build_report_item=_ng_pair_build_report_item,
    fields=(
        ConstraintFieldSpec(
            name="pairs",
            label="NGペア",
            field_type="employee_pair_list",
            help_text="同じ部署に配属してはいけない社員の組を追加します。",
        ),
    ),
)

# CA で入力・適用する制約種別（登録順にレポート生成される）。
CA_CONSTRAINT_SPECS: list[ConstraintSpec] = [NG_PAIR_SPEC]

_REGISTRY: dict[str, ConstraintSpec] = {spec.constraint_type: spec for spec in CA_CONSTRAINT_SPECS}


def is_valid_constraint(key: str) -> bool:
    """制約種別キーがレジストリに登録済みか。"""
    return key in _REGISTRY


def get_constraint_spec(key: str) -> ConstraintSpec:
    """制約種別キーから ConstraintSpec を取得する。"""
    return _REGISTRY[key]


def ca_constraint_metas() -> list[CaConstraintMetaDTO]:
    """全 CA 制約種別のメタ情報を登録順に返す（GetCaConstraintMeta 用）。"""
    return [
        CaConstraintMetaDTO(
            key=spec.constraint_type,
            label=spec.label,
            fields=[
                ConstraintFieldMetaDTO(
                    name=f.name,
                    label=f.label,
                    field_type=f.field_type,
                    help_text=f.help_text,
                )
                for f in spec.fields
            ],
        )
        for spec in CA_CONSTRAINT_SPECS
    ]
