"""投票集計の共通データモデル。

マッチング層（domain/matching/models.py）と同じ規約に従う:
frozen dataclass（kw_only）、入力検証は `__post_init__` で ValueError。

インデックス規約: 選択肢は 0-indexed（`0 〜 num_options - 1`）。
外部入力（API）でも選択肢は配列位置で参照するため 0-indexed のまま扱う
（マッチングの選好リスト 1-indexed 規約とは対象が異なる点に注意）。
"""

from __future__ import annotations

from dataclasses import dataclass

# 選択肢数の上限・下限（2〜10 件）。
MIN_OPTIONS = 2
MAX_OPTIONS = 10


def _validate_num_options(num_options: int) -> None:
    if not MIN_OPTIONS <= num_options <= MAX_OPTIONS:
        raise ValueError(f"選択肢数は {MIN_OPTIONS}〜{MAX_OPTIONS} 件にしてください")


@dataclass(frozen=True, kw_only=True)
class ChoiceTallyInput:
    """単一選択（多数決）投票の集計入力。

    Attributes:
        num_options: 選択肢数。
        choices: 各投票者が選んだ選択肢番号（0-indexed）のリスト。
    """

    num_options: int
    choices: list[int]

    def __post_init__(self) -> None:
        _validate_num_options(self.num_options)
        for i, choice in enumerate(self.choices):
            if not 0 <= choice < self.num_options:
                raise ValueError(f"投票 {i + 1} 件目の選択肢番号 {choice} が範囲外です")


@dataclass(frozen=True, kw_only=True)
class RankingTallyInput:
    """順位付け投票の集計入力。

    Attributes:
        num_options: 選択肢数。
        rankings: 各投票者の順位付け。好ましい順に並べた選択肢番号
            （0-indexed）の完全順列。
    """

    num_options: int
    rankings: list[list[int]]

    def __post_init__(self) -> None:
        _validate_num_options(self.num_options)
        expected = set(range(self.num_options))
        for i, ranking in enumerate(self.rankings):
            if set(ranking) != expected or len(ranking) != self.num_options:
                raise ValueError(
                    f"投票 {i + 1} 件目の順位付けは全選択肢を 1 回ずつ含む必要があります"
                )


@dataclass(frozen=True, kw_only=True)
class ApprovalTallyInput:
    """承認投票の集計入力。

    Attributes:
        num_options: 選択肢数。
        approvals: 各投票者が承認した選択肢番号（0-indexed）の集合（リスト表現）。
    """

    num_options: int
    approvals: list[list[int]]

    def __post_init__(self) -> None:
        _validate_num_options(self.num_options)
        for i, approval in enumerate(self.approvals):
            if len(set(approval)) != len(approval):
                raise ValueError(f"投票 {i + 1} 件目の承認リストに重複があります")
            for option in approval:
                if not 0 <= option < self.num_options:
                    raise ValueError(f"投票 {i + 1} 件目の選択肢番号 {option} が範囲外です")


@dataclass(frozen=True, kw_only=True)
class RuleResult:
    """1 つの投票ルールによる集計結果。

    Attributes:
        rule: ルールキー（plurality / borda / approval / condorcet）。
        scores: 選択肢ごとのスコア（ルールにより意味が異なる。得票数・ボルダ点・
            承認数・Copeland 勝ち数）。
        ranking: スコア降順（同点はインデックス昇順）の選択肢番号列。
        winners: 最高スコアの選択肢番号（同点をすべて含む、昇順）。
    """

    rule: str
    scores: list[float]
    ranking: list[int]
    winners: list[int]
