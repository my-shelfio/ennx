"""投票結果の性質レポート（純粋関数）。

社会選択理論の代表的な性質（コンドルセ勝者の有無・多数決の逆理・
過半数支持・ルール間の勝者一致）を判定し、マッチングと共通の
ReportItem（domain/services/report.py）で返す。
"""

from __future__ import annotations

from shared.domain.report import ReportItem

from .models import RankingTallyInput, RuleResult
from .rules import condorcet_winner, first_choices, tally_plurality


def _names(option_names: list[str], options: list[int]) -> str:
    return "、".join(option_names[option] for option in options)


def build_voting_report(
    tally_input: RankingTallyInput,
    option_names: list[str],
    results: list[RuleResult],
) -> list[ReportItem]:
    """順位付け投票の性質レポートを組み立てる。

    Args:
        tally_input: 順位付けの集計入力。
        option_names: 選択肢の表示名（0-indexed）。
        results: 比較対象のルール別集計結果（plurality / borda / condorcet 等）。
    """
    items: list[ReportItem] = []
    total = len(tally_input.rankings)

    # 1. コンドルセ勝者の有無。
    winner = condorcet_winner(tally_input)
    if winner is not None:
        items.append(
            ReportItem(
                label="コンドルセ勝者",
                status="ok",
                detail=(
                    f"「{option_names[winner]}」は他のどの案との 1 対 1 比較でも"
                    "過半数の支持を得ます。"
                ),
            )
        )
    else:
        items.append(
            ReportItem(
                label="コンドルセ勝者",
                status="info",
                detail="1 対 1 比較で全案に勝つ案は存在しません（循環が発生しています）。",
            )
        )

    # 2. 過半数支持（第 1 希望の過半数を得る案）。
    plurality = tally_plurality(first_choices(tally_input))
    majority = [
        option for option, score in enumerate(plurality.scores) if total > 0 and score * 2 > total
    ]
    if majority:
        items.append(
            ReportItem(
                label="過半数支持",
                status="ok",
                detail=f"「{_names(option_names, majority)}」が第 1 希望の過半数を得ています。",
            )
        )
    else:
        items.append(
            ReportItem(
                label="過半数支持",
                status="info",
                detail="第 1 希望で過半数を得る案はありません。",
            )
        )

    # 3. 多数決の逆理（コンドルセ勝者が存在するのに多数決では勝てない）。
    if winner is not None:
        if winner in plurality.winners:
            items.append(
                ReportItem(
                    label="多数決の逆理",
                    status="ok",
                    detail="多数決の勝者はコンドルセ勝者と一致します。",
                )
            )
        else:
            items.append(
                ReportItem(
                    label="多数決の逆理",
                    status="ng",
                    detail=(
                        f"1 対 1 比較で全案に勝つ「{option_names[winner]}」が、"
                        f"多数決では「{_names(option_names, plurality.winners)}」に敗れます。"
                    ),
                )
            )

    # 4. ルール間の勝者一致。
    winner_sets = {tuple(result.winners) for result in results}
    if len(winner_sets) <= 1:
        items.append(
            ReportItem(
                label="ルール間の一致",
                status="ok",
                detail="比較した全ルールで勝者が一致します。結果はルール選択に頑健です。",
            )
        )
    else:
        detail = "／".join(
            f"{result.rule}: {_names(option_names, result.winners)}" for result in results
        )
        items.append(
            ReportItem(
                label="ルール間の一致",
                status="info",
                detail=f"ルールにより勝者が変わります（{detail}）。ルール選択の説明が必要です。",
            )
        )
    return items
