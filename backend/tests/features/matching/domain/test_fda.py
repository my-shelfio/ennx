"""FDA アルゴリズムのテスト。"""

from __future__ import annotations

import pytest

from features.matching.domain import FDAInput, flexible_deferred_acceptance


def _example3_input() -> FDAInput:
    """fda_algorithm_exec 例3: 部署配属18社員・6部署・3地域。"""
    return FDAInput(
        proposer_prefs=(
            [[1, 2, 3, 4, 5, 6]] * 3  # 営業1課志望（地域α）
            + [[2, 5, 6, 4, 3, 1]] * 5  # 基幹システム課志望（地域β）
            + [[3, 5, 6, 4, 2, 1]] * 5  # 製品開発課志望（地域β）
            + [[4, 5, 6, 1, 2, 3]] * 3  # 経営企画課志望（地域γ）
            + [[5, 6, 4, 1, 2, 3]]  # 商品企画課志望（地域γ）
            + [[6, 5, 4, 1, 2, 3]]  # マーケティング課志望（地域γ）
        ),
        receiver_prefs=[
            list(range(1, 19)),
            [4, 5, 6, 7, 8, 1, 2, 3, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
            [9, 10, 11, 12, 13, 4, 5, 6, 7, 8, 1, 2, 3, 14, 15, 16, 17, 18],
            [14, 15, 16, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17, 18],
            [17, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18],
            [18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
        ],
        capacities=[2, 4, 4, 2, 1, 1],
        max_caps=[3, 5, 5, 3, 2, 2],
        regions=[0, 1, 1, 2, 2, 2],
        regional_caps=[3, 8, 7],
        nomination_order=[0, 1, 2, 3, 4, 5],
    )


def test_example1_regional_cap_not_binding() -> None:
    """例1: 地域上限が非 binding → DA と同じく全員マッチ。"""
    data = FDAInput(
        proposer_prefs=[[1]] * 3 + [[2]] * 7,
        receiver_prefs=[list(range(1, 11)), list(range(1, 11))],
        capacities=[3, 5],
        max_caps=[10, 10],
        regions=[0, 0],
        regional_caps=[10],
        nomination_order=[0, 1],
    )

    result = flexible_deferred_acceptance(data)

    assert result.proposer_match == [0, 0, 0, 1, 1, 1, 1, 1, 1, 1]
    assert result.receiver_match == [[0, 1, 2], [3, 4, 5, 6, 7, 8, 9]]


def test_example2_regional_cap_binding() -> None:
    """例2: 地域上限（2人）が binding → 未マッチが発生する。"""
    data = FDAInput(
        proposer_prefs=[[1, 2], [1, 2], [2, 1], [2, 1]],
        receiver_prefs=[[1, 2, 3, 4], [3, 4, 1, 2]],
        capacities=[1, 1],
        max_caps=[3, 3],
        regions=[0, 0],
        regional_caps=[2],
        nomination_order=[0, 1],
    )

    result = flexible_deferred_acceptance(data)

    assert result.proposer_match == [0, -1, 1, -1]
    assert result.receiver_match == [[0], [2]]


def test_example3_department_assignment() -> None:
    """例3: 部署配属18社員・6部署・3地域（待機リストと繰り上げが発生）。"""
    result = flexible_deferred_acceptance(_example3_input())

    assert result.proposer_match == [
        0,
        0,
        0,
        1,
        1,
        1,
        1,
        4,
        2,
        2,
        2,
        2,
        5,
        3,
        3,
        3,
        4,
        5,
    ]
    assert result.receiver_match == [
        [0, 1, 2],
        [3, 4, 5, 6],
        [8, 9, 10, 11],
        [13, 14, 15],
        [16, 7],
        [17, 12],
    ]


def test_regional_cap_not_exceeded_after_promotion() -> None:
    """繰り上げ後の後続ラウンドでも地域上限を超過しない（回帰テスト）。

    ラウンド1で P2 が r2（目標定員0）へ繰り上げられ地域枠1を消費した後、
    ラウンド2で P1 が r1 に応募するケース。修正前はレギュラーフェーズが
    地域上限を確認せず受け入れ、地域0 の配属数が 2（上限1）になっていた。
    """
    data = FDAInput(
        proposer_prefs=[[2, 1], [2]],  # P1: r2 > r1 / P2: r2 のみ
        receiver_prefs=[[1], [2, 1]],
        capacities=[1, 0],
        max_caps=[1, 2],
        regions=[0, 0],
        regional_caps=[1],  # 目標定員合計 1+0=1 ≤ 1（実行可能性の前提は満たす）
        nomination_order=[0, 1],
    )

    result = flexible_deferred_acceptance(data)

    regional_count = sum(len(matched) for matched in result.receiver_match)
    assert regional_count <= 1, f"地域0 の配属数 {regional_count} が上限 1 を超過"
    # P1 は r1 にマッチし、P2 は目標定員超過で差し戻された後に未マッチとなる
    assert result.proposer_match == [0, -1]
    assert result.receiver_match == [[0], []]


class TestFDAInputValidation:
    """FDAInput の入力検証。"""

    def test_max_cap_below_capacity_raises(self) -> None:
        """設置上限が定員未満なら ValueError。"""
        with pytest.raises(ValueError, match="設置上限"):
            FDAInput(
                proposer_prefs=[[1]],
                receiver_prefs=[[1]],
                capacities=[2],
                max_caps=[1],
                regions=[0],
                regional_caps=[1],
                nomination_order=[0],
            )

    def test_region_out_of_range_raises(self) -> None:
        """範囲外の地域番号は ValueError。"""
        with pytest.raises(ValueError, match="地域番号"):
            FDAInput(
                proposer_prefs=[[1]],
                receiver_prefs=[[1]],
                capacities=[1],
                max_caps=[1],
                regions=[1],
                regional_caps=[1],
                nomination_order=[0],
            )

    def test_regional_cap_below_target_capacity_sum_raises(self) -> None:
        """地域の目標定員合計が地域上限を超える入力は ValueError（実行可能性の前提）。"""
        with pytest.raises(ValueError, match="地域上限"):
            FDAInput(
                proposer_prefs=[[1]],
                receiver_prefs=[[1]],
                capacities=[1],
                max_caps=[1],
                regions=[0],
                regional_caps=[0],  # 目標定員1 > 地域上限0
                nomination_order=[0],
            )

    def test_invalid_nomination_order_raises(self) -> None:
        """指名順序が受入者番号の並べ替えでなければ ValueError。"""
        with pytest.raises(ValueError, match="nomination_order"):
            FDAInput(
                proposer_prefs=[[1, 2]],
                receiver_prefs=[[1], [1]],
                capacities=[1, 1],
                max_caps=[1, 1],
                regions=[0, 0],
                regional_caps=[2],
                nomination_order=[0, 0],
            )
