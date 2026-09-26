"""投票の性質レポート（build_voting_report）の固定例テスト。

レポートの判定を誤っても画面上は自然な文章として表示されるため目視では検出できない。
とくに過半数判定（第 1 希望の得票 × 2 > 総票数）は、偶数票でちょうど半数のときに
off-by-one が起きやすいため、境界を固定例で押さえる。

検証粒度は label / status と、detail に対象の選択肢名が含まれることまでとする
（文言の微修正でテストが壊れないようにするため）。
"""

from __future__ import annotations

from features.voting.domain import (
    RankingTallyInput,
    build_voting_report,
    tally_borda,
    tally_condorcet,
    tally_plurality,
)
from features.voting.domain.rules import first_choices
from shared.domain.report import ReportItem

A, B, C = 0, 1, 2
NAMES = ["案A", "案B", "案C"]


def _report(rankings: list[list[int]]) -> list[ReportItem]:
    """ユースケースと同じ比較ルール（多数決・ボルダ・コンドルセ）でレポートを組み立てる。"""
    tally_input = RankingTallyInput(num_options=len(NAMES), rankings=rankings)
    results = [
        tally_plurality(first_choices(tally_input)),
        tally_borda(tally_input),
        tally_condorcet(tally_input),
    ]
    return build_voting_report(tally_input, NAMES, results)


def _item(report: list[ReportItem], label: str) -> ReportItem:
    matches = [item for item in report if item.label == label]
    assert len(matches) == 1, f"「{label}」の項目がちょうど 1 件あること: {report}"
    return matches[0]


def _labels(report: list[ReportItem]) -> list[str]:
    return [item.label for item in report]


class TestMajority:
    """過半数支持（第 1 希望の過半数を得る案）の境界。"""

    def test_exactly_half_of_even_votes_is_not_majority(self) -> None:
        # 4 票中 2 票が案A を第 1 希望 → ちょうど半数は過半数ではない。
        report = _report([[A, B, C], [A, C, B], [B, A, C], [C, B, A]])
        assert _item(report, "過半数支持").status == "info"

    def test_more_than_half_of_even_votes_is_majority(self) -> None:
        # 4 票中 3 票が案A を第 1 希望。
        item = _item(_report([[A, B, C], [A, C, B], [A, B, C], [B, A, C]]), "過半数支持")
        assert item.status == "ok"
        assert "案A" in item.detail

    def test_more_than_half_of_odd_votes_is_majority(self) -> None:
        # 3 票中 2 票が案A を第 1 希望。
        item = _item(_report([[A, B, C], [A, C, B], [B, A, C]]), "過半数支持")
        assert item.status == "ok"
        assert "案A" in item.detail


class TestCondorcetWinner:
    """コンドルセ勝者の有無。"""

    def test_cycle_has_no_condorcet_winner(self) -> None:
        # A>B>C / B>C>A / C>A>B の循環（投票の逆理（コンドルセのパラドックス）の古典例）。
        report = _report([[A, B, C], [B, C, A], [C, A, B]])
        assert _item(report, "コンドルセ勝者").status == "info"

    def test_existing_condorcet_winner_is_reported_by_name(self) -> None:
        # 案A は案B に 2 対 1、案C に 3 対 0 で勝つ。
        item = _item(_report([[A, B, C], [A, C, B], [B, A, C]]), "コンドルセ勝者")
        assert item.status == "ok"
        assert "案A" in item.detail


class TestPluralityParadox:
    """多数決の逆理（コンドルセ勝者が多数決で勝てない）。"""

    def test_condorcet_winner_losing_plurality_is_reported(self) -> None:
        # 3 票 A>B>C / 2 票 C>B>A / 2 票 B>C>A。
        # 第 1 希望は案A が 3 票で単独最多だが、案B は案A に 4 対 3、案C に 5 対 2 で勝つ
        # コンドルセ勝者。
        rankings = [[A, B, C]] * 3 + [[C, B, A]] * 2 + [[B, C, A]] * 2
        item = _item(_report(rankings), "多数決の逆理")
        assert item.status == "ng"
        assert "案B" in item.detail
        assert "案A" in item.detail

    def test_condorcet_winner_winning_plurality_is_ok(self) -> None:
        # 案A がコンドルセ勝者かつ第 1 希望の最多。
        item = _item(_report([[A, B, C], [A, C, B], [B, A, C]]), "多数決の逆理")
        assert item.status == "ok"

    def test_no_paradox_item_without_condorcet_winner(self) -> None:
        # コンドルセ勝者がいない場合、逆理は定義されないため項目自体を出さない。
        report = _report([[A, B, C], [B, C, A], [C, A, B]])
        assert "多数決の逆理" not in _labels(report)
