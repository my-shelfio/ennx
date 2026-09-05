"""assignment ユースケースの入力 DTO。

ステートレス API のリクエストに対応するフレームワーク非依存の入力データ。
presentation 層の Pydantic スキーマから本 DTO へ変換してユースケースに渡す。
希望順位リストは外部入力の規約どおり 1-indexed。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, kw_only=True)
class ConstraintEntry:
    """追加の上限制約 1 件（制約レジストリの登録種別に対応）。

    Attributes:
        type: 制約種別キー（例: "ng_pair"）。
        params: 制約種別ごとのパラメータ（0-indexed）。
    """

    type: str
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, kw_only=True)
class AssignmentRequest:
    """割り当て実行・検証の入力（RunAssignment / ValidateAssignmentInput 共通）。

    利用者はメカニズム名ではなく「制約種別」を選ぶ。部署の側は候補者を
    順位づけしないため、matching 機能と違い receiver_prefs は存在しない。

    Attributes:
        constraint_type: 制約種別キー（capacity_only / general）。
        capacities: 部署 j の受け入れ人数（供給数）。
        agent_prefs: 社員 i の希望順位リスト（1-indexed の部署番号、好きな順）。
            リストに含まれない部署は「希望しない」を意味する。
        employee_names: 社員の表示名（省略時は「社員1」〜）。
        department_names: 部署の表示名（省略時は「部署1」〜）。
        constraints: 追加の上限制約（general のみ任意指定）。
    """

    constraint_type: str
    capacities: list[int]
    agent_prefs: list[list[int]]
    employee_names: list[str] | None = None
    department_names: list[str] | None = None
    constraints: list[ConstraintEntry] | None = None

    @property
    def num_employees(self) -> int:
        """社員数。"""
        return len(self.agent_prefs)

    @property
    def num_departments(self) -> int:
        """部署数。"""
        return len(self.capacities)
