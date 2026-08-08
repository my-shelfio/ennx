"""ユースケース入力 DTO。

ステートレス API のリクエストに対応する、フレームワーク非依存の
入力データ。presentation 層の Pydantic スキーマから本 DTO へ変換して
ユースケースに渡す。選好リストは外部入力の規約どおり 1-indexed
（backend/src/domain/matching/models.py を参照）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, kw_only=True)
class ConstraintEntry:
    """CA の追加制約 1 件（制約レジストリの登録種別に対応）。

    Attributes:
        type: 制約種別キー（例: "ng_pair"）。application/constraints.py の
            レジストリに登録された種別のみ受理する。
        params: 制約種別ごとのパラメータ（例: {"pairs": [[0, 1]]}、0-indexed）。
    """

    type: str
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, kw_only=True)
class MatchingRequest:
    """マッチング実行・検証の入力（RunMatching / ValidateInput 共通）。

    現行 Flask 実装のセッション最小入力に相当する全量を 1 リクエストで受け取る。
    利用者はアルゴリズムではなく「制約種別」を選ぶ。

    Attributes:
        constraint_type: 制約種別キー（capacity_only / regional_cap / general）。
            内部アルゴリズム（da / fda / ca）へのディスパッチは application 層が行う。
        capacities: 部署 j の定員（FDA では目標定員として扱う）。
        proposer_prefs: 社員 i の希望順位リスト（1-indexed の部署番号、好きな順）。
        receiver_prefs: 部署 j の優先順位リスト（1-indexed の社員番号、好きな順）。
        employee_names: 社員の表示名（省略時は「社員1」〜）。
        department_names: 部署の表示名（省略時は「部署1」〜）。
        max_caps: 部署 j の設置上限（regional_cap のみ必須）。
        regions: 部署 j の地域番号 0-indexed（regional_cap のみ必須）。
        regional_caps: 地域 k の受け入れ上限（regional_cap のみ必須）。
        constraints: 追加制約（general のみ任意指定）。
    """

    constraint_type: str
    capacities: list[int]
    proposer_prefs: list[list[int]]
    receiver_prefs: list[list[int]]
    employee_names: list[str] | None = None
    department_names: list[str] | None = None
    max_caps: list[int] | None = None
    regions: list[int] | None = None
    regional_caps: list[int] | None = None
    constraints: list[ConstraintEntry] | None = None

    @property
    def num_employees(self) -> int:
        """社員数。"""
        return len(self.proposer_prefs)

    @property
    def num_departments(self) -> int:
        """部署数。"""
        return len(self.receiver_prefs)
