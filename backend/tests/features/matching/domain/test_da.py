"""DA アルゴリズムのテスト。"""

from __future__ import annotations

import pytest

from features.matching.domain import DAInput, deferred_acceptance


def test_example1_one_to_one() -> None:
    """例1: 学生と大学の1対1マッチング。"""
    data = DAInput(
        proposer_prefs=[
            [1, 2, 3, 4],  # 田中: 東工大 > 早稲田 > 慶應 > 明治
            [1, 3, 2, 4],  # 鈴木: 東工大 > 慶應 > 早稲田 > 明治
            [2, 1, 3, 4],  # 佐藤: 早稲田 > 東工大 > 慶應 > 明治
            [3, 2, 1, 4],  # 高橋: 慶應 > 早稲田 > 東工大 > 明治
        ],
        receiver_prefs=[
            [2, 1, 3, 4],  # 東工大: 鈴木 > 田中 > 佐藤 > 高橋
            [1, 2, 4, 3],  # 早稲田: 田中 > 鈴木 > 高橋 > 佐藤
            [4, 3, 1, 2],  # 慶應:   高橋 > 佐藤 > 田中 > 鈴木
            [3, 4, 2, 1],  # 明治:   佐藤 > 高橋 > 鈴木 > 田中
        ],
        capacities=[1, 1, 1, 1],
    )

    result = deferred_acceptance(data)

    assert result.proposer_match == [1, 0, 3, 2]
    assert result.receiver_match == [[1], [0], [3], [2]]


def test_example2_many_to_one() -> None:
    """例2: 研修医と病院の多対1マッチング（定員2）。"""
    data = DAInput(
        proposer_prefs=[
            [1, 2, 3],  # 田村
            [1, 3, 2],  # 中川
            [1, 2, 3],  # 浜田
            [3, 2, 1],  # 安田
            [3, 1, 2],  # 橋本
            [2, 3, 1],  # 本田
        ],
        receiver_prefs=[
            [1, 2, 3, 4, 5, 6],  # 東大病院
            [3, 1, 6, 2, 5, 4],  # 慶應病院
            [5, 6, 4, 3, 2, 1],  # 聖路加
        ],
        capacities=[2, 2, 2],
    )

    result = deferred_acceptance(data)

    assert result.proposer_match == [0, 0, 1, 2, 2, 1]
    assert result.receiver_match == [[0, 1], [2, 5], [4, 3]]


def test_example3_unmatched_proposers() -> None:
    """例3: 選好リストが短い提案者が未マッチ（-1）になるケース。"""
    data = DAInput(
        proposer_prefs=[[1]] * 3 + [[2]] * 7,
        receiver_prefs=[
            list(range(1, 11)),
            list(range(1, 11)),
        ],
        capacities=[3, 5],
    )

    result = deferred_acceptance(data)

    assert result.proposer_match == [0, 0, 0, 1, 1, 1, 1, 1, -1, -1]
    assert result.receiver_match == [[0, 1, 2], [3, 4, 5, 6, 7]]


def test_example4_underfilled_receiver() -> None:
    """例4: 受入者側に定員未充足（空き定員）が発生するケース。"""
    data = DAInput(
        proposer_prefs=[
            [1, 2, 3],
            [1, 2, 3],
            [2, 1, 3],
            [2, 1, 3],
        ],
        receiver_prefs=[
            [1, 2, 3, 4],
            [3, 4, 1, 2],
            [1, 2, 3, 4],
        ],
        capacities=[2, 2, 2],
    )

    result = deferred_acceptance(data)

    assert result.proposer_match == [0, 0, 1, 1]
    assert result.receiver_match == [[0, 1], [2, 3], []]


def test_unacceptable_receiver_side() -> None:
    """受入者の優先順位リストに載らない提案者は拒否される（個人合理性）。"""
    data = DAInput(
        proposer_prefs=[[1], [1]],
        receiver_prefs=[[1]],  # 受入者1は提案者2を受け入れ不可能
        capacities=[2],
    )

    result = deferred_acceptance(data)

    assert result.proposer_match == [0, -1]
    assert result.receiver_match == [[0]]


class TestDAInputValidation:
    """DAInput の入力検証。"""

    def test_duplicate_preference_raises(self) -> None:
        """選好リストの重複は ValueError。"""
        with pytest.raises(ValueError, match="重複"):
            DAInput(
                proposer_prefs=[[1, 1]],
                receiver_prefs=[[1], [1]],
                capacities=[1, 1],
            )

    def test_out_of_range_preference_raises(self) -> None:
        """範囲外の相手番号は ValueError。"""
        with pytest.raises(ValueError, match="範囲外"):
            DAInput(
                proposer_prefs=[[3]],
                receiver_prefs=[[1], [1]],
                capacities=[1, 1],
            )

    def test_capacities_length_mismatch_raises(self) -> None:
        """capacities の長さ不一致は ValueError。"""
        with pytest.raises(ValueError, match="capacities"):
            DAInput(
                proposer_prefs=[[1]],
                receiver_prefs=[[1]],
                capacities=[1, 1],
            )

    def test_negative_capacity_raises(self) -> None:
        """負の定員は ValueError。"""
        with pytest.raises(ValueError, match="定員が負"):
            DAInput(
                proposer_prefs=[[1]],
                receiver_prefs=[[1]],
                capacities=[-1],
            )
