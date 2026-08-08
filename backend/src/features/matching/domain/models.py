"""マッチングアルゴリズム共通の入出力データモデル。

選好リストは外部入力では 1-indexed（相手番号 1〜N）で受け取り、
アルゴリズム内部では 0-indexed に統一して扱う（変換は build_rank を参照）。

このモジュールのデータモデルは DA・FDA・CA で共通利用できるよう、
基底クラス + アルゴリズム別の派生クラスで構成する。
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field

from .events import MatchingEvent

# 一般上限制約の型: 提案者集合（0-indexed）→ 実行可能かどうか（CA で使用）
# ※ 遺伝性（実行可能な集合の部分集合も実行可能）を満たす上限制約のみを渡すこと。
Constraint = Callable[[frozenset[int]], bool]


@dataclass(frozen=True, kw_only=True)
class BaseMatchingInput:
    """全アルゴリズム共通の入力（選好プロファイルと表示名）。

    Attributes:
        proposer_prefs: 提案者 i の選好リスト（1-indexed の受入者番号、好きな順）。
            リストに含まれない受入者は「受け入れ不可能」を意味する。
        receiver_prefs: 受入者 j の優先順位リスト（1-indexed の提案者番号、好きな順）。
            リストに含まれない提案者は「受け入れ不可能」を意味する。
        proposer_names: 提案者の表示名（省略時は "P1", "P2", ...）。
        receiver_names: 受入者の表示名（省略時は "R1", "R2", ...）。
    """

    proposer_prefs: list[list[int]]
    receiver_prefs: list[list[int]]
    proposer_names: list[str] | None = None
    receiver_names: list[str] | None = None

    def __post_init__(self) -> None:
        n_p = len(self.proposer_prefs)
        n_r = len(self.receiver_prefs)
        for i, prefs in enumerate(self.proposer_prefs):
            if len(set(prefs)) != len(prefs):
                raise ValueError(f"提案者 {i} の選好リストに重複があります: {prefs}")
            for r in prefs:
                if not 1 <= r <= n_r:
                    raise ValueError(
                        f"提案者 {i} の選好リストに範囲外の受入者番号 {r} があります"
                        f"（1〜{n_r} で指定）"
                    )
        for j, prefs in enumerate(self.receiver_prefs):
            if len(set(prefs)) != len(prefs):
                raise ValueError(f"受入者 {j} の優先順位リストに重複があります: {prefs}")
            for p in prefs:
                if not 1 <= p <= n_p:
                    raise ValueError(
                        f"受入者 {j} の優先順位リストに範囲外の提案者番号 {p} があります"
                        f"（1〜{n_p} で指定）"
                    )
        if self.proposer_names is not None and len(self.proposer_names) != n_p:
            raise ValueError("proposer_names の長さが proposer_prefs と一致しません")
        if self.receiver_names is not None and len(self.receiver_names) != n_r:
            raise ValueError("receiver_names の長さが receiver_prefs と一致しません")

    @property
    def n_proposers(self) -> int:
        """提案者数。"""
        return len(self.proposer_prefs)

    @property
    def n_receivers(self) -> int:
        """受入者数。"""
        return len(self.receiver_prefs)

    def p_name(self, i: int) -> str:
        """提案者 i（0-indexed）の表示名を返す。"""
        return self.proposer_names[i] if self.proposer_names else f"P{i + 1}"

    def r_name(self, j: int) -> str:
        """受入者 j（0-indexed）の表示名を返す。"""
        return self.receiver_names[j] if self.receiver_names else f"R{j + 1}"


@dataclass(frozen=True, kw_only=True)
class DAInput(BaseMatchingInput):
    """DA アルゴリズムの入力（定員制約付き多対1マッチング）。

    Attributes:
        capacities: 受入者 j の定員。
    """

    capacities: list[int]

    def __post_init__(self) -> None:
        super().__post_init__()
        if len(self.capacities) != self.n_receivers:
            raise ValueError("capacities の長さが receiver_prefs と一致しません")
        for j, cap in enumerate(self.capacities):
            if cap < 0:
                raise ValueError(f"受入者 {j} の定員が負です: {cap}")


@dataclass(frozen=True, kw_only=True)
class FDAInput(DAInput):
    """FDA アルゴリズムの入力（地域上限制約付き多対1マッチング）。

    capacities は目標定員（レギュラーフェーズの閾値）として扱う。

    Attributes:
        max_caps: 受入者 j の設置上限（物理的な最大受入数）。
        regions: 受入者 j が属する地域の番号（0-indexed）。
        regional_caps: 地域 k の受け入れ上限。
        nomination_order: 待機リストフェーズでの受入者の指名順序（0-indexed）。
    """

    max_caps: list[int]
    regions: list[int]
    regional_caps: list[int]
    nomination_order: list[int]

    def __post_init__(self) -> None:
        super().__post_init__()
        n_r = self.n_receivers
        if len(self.max_caps) != n_r:
            raise ValueError("max_caps の長さが receiver_prefs と一致しません")
        if len(self.regions) != n_r:
            raise ValueError("regions の長さが receiver_prefs と一致しません")
        for j, (cap, max_cap) in enumerate(zip(self.capacities, self.max_caps, strict=True)):
            if max_cap < cap:
                raise ValueError(f"受入者 {j} の設置上限 {max_cap} が定員 {cap} を下回っています")
        n_regions = len(self.regional_caps)
        for j, region in enumerate(self.regions):
            if not 0 <= region < n_regions:
                raise ValueError(f"受入者 {j} の地域番号 {region} が範囲外です")
        for k, regional_cap in enumerate(self.regional_caps):
            if regional_cap < 0:
                raise ValueError(f"地域 {k} の上限が負です: {regional_cap}")
        if sorted(self.nomination_order) != list(range(n_r)):
            raise ValueError(
                "nomination_order は全受入者番号（0-indexed）の並べ替えである必要があります"
            )
        # 実行可能性の前提条件（Kamada and Kojima, 2015）:
        # 各地域について、所属受入者の目標定員の合計が地域上限以下であること。
        # レギュラーフェーズは地域上限を参照せず定員まで受け入れるため、
        # この前提を破ると地域上限を超えるマッチングが生じうる。
        region_target = [0] * n_regions
        for j, region in enumerate(self.regions):
            region_target[region] += self.capacities[j]
        for k, (target, regional_cap) in enumerate(
            zip(region_target, self.regional_caps, strict=True)
        ):
            if target > regional_cap:
                raise ValueError(
                    f"地域 {k} の目標定員の合計 {target} が地域上限 {regional_cap} を"
                    "超えています（目標定員の合計は地域上限以下にしてください）"
                )


@dataclass(frozen=True, kw_only=True)
class CAInput(BaseMatchingInput):
    """CA アルゴリズムの入力（一般上限制約付き多対1マッチング）。

    Attributes:
        constraints: 受入者 j の実行可能性判定関数。遺伝性を満たす上限制約に限る
            （ca モジュールの docstring を参照）。
    """

    constraints: list[Constraint]

    def __post_init__(self) -> None:
        super().__post_init__()
        if len(self.constraints) != self.n_receivers:
            raise ValueError("constraints の長さが receiver_prefs と一致しません")
        for j, constraint in enumerate(self.constraints):
            # 遺伝性を満たす上限制約では空集合は常に実行可能
            if not constraint(frozenset()):
                raise ValueError(
                    f"受入者 {j} の制約が空集合を実行不可能と判定しました"
                    "（遺伝性を満たす上限制約のみ指定できます）"
                )


@dataclass(frozen=True, kw_only=True)
class MatchingResult:
    """マッチング結果（全アルゴリズム共通）。

    Attributes:
        proposer_match: proposer_match[i] = マッチした受入者の 0-index（-1 = 未マッチ）。
        receiver_match: receiver_match[j] = マッチした提案者の 0-index リスト。
        events: 実行過程のイベントログ（実行順）。過程可視化（M4）で利用する。
    """

    proposer_match: list[int]
    receiver_match: list[list[int]]
    events: list[MatchingEvent] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class CAResult(MatchingResult):
    """CA アルゴリズムの結果。

    Attributes:
        cutoff_profile: 最終カットオフプロファイル p*。
    """

    cutoff_profile: list[int] = field(default_factory=list)


def build_rank(prefs: list[list[int]], n_targets: int) -> list[list[int]]:
    """選好リスト（1-indexed）を順位表（0-indexed）に変換する。

    rank[i][t] = エージェント i にとっての相手 t の順位（0 が最優先）。
    選好リストに含まれない相手の順位は n_targets（= 受け入れ不可能）とする。

    Args:
        prefs: 各エージェントの選好リスト（1-indexed の相手番号）。
        n_targets: 相手側のエージェント数。

    Returns:
        順位表（len(prefs) × n_targets）。
    """
    rank = [[n_targets] * n_targets for _ in prefs]
    for i, row in enumerate(prefs):
        for position, target in enumerate(row):
            rank[i][target - 1] = position
    return rank
