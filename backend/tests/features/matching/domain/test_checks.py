"""安定性チェッカー（checks モジュール）のテスト。

受入条件:
    既知の安定／不安定マッチング例で正しく判定する。
"""

from __future__ import annotations

from features.matching.domain import (
    check_capacity_compliance,
    check_fairness,
    check_individual_rationality,
    check_no_blocking_pair,
    check_stability,
    check_weak_stability,
)

# 例1（da_algorithm_exec.py）: 学生と大学の1対1マッチング
PROPOSER_PREFS = [[1, 2, 3, 4], [1, 3, 2, 4], [2, 1, 3, 4], [3, 2, 1, 4]]
RECEIVER_PREFS = [[2, 1, 3, 4], [1, 2, 4, 3], [4, 3, 1, 2], [3, 4, 2, 1]]
CAPACITIES = [1, 1, 1, 1]
# DA の出力（安定マッチング）
STABLE_PROPOSER_MATCH = [1, 0, 3, 2]
STABLE_RECEIVER_MATCH = [[1], [0], [3], [2]]


class TestStableMatching:
    """既知の安定マッチングを正しく「安定」と判定する。"""

    def test_da_output_is_stable(self) -> None:
        """DA の出力は安定と判定される。"""
        result = check_stability(
            PROPOSER_PREFS,
            RECEIVER_PREFS,
            STABLE_PROPOSER_MATCH,
            STABLE_RECEIVER_MATCH,
            CAPACITIES,
        )

        assert result.passed
        assert result.violations == []
        assert bool(result) is True

    def test_da_output_is_individually_rational(self) -> None:
        """DA の出力は個人合理性を満たす。"""
        result = check_individual_rationality(
            PROPOSER_PREFS,
            RECEIVER_PREFS,
            STABLE_PROPOSER_MATCH,
            STABLE_RECEIVER_MATCH,
        )

        assert result.passed

    def test_da_output_respects_capacities(self) -> None:
        """DA の出力は定員を遵守する。"""
        result = check_capacity_compliance(STABLE_RECEIVER_MATCH, CAPACITIES)

        assert result.passed


class TestUnstableMatching:
    """既知の不安定マッチングを正しく「不安定」と判定する。"""

    def test_swapped_matching_has_blocking_pair(self) -> None:
        """安定マッチングの2ペアを入れ替えるとブロッキングペアが検出される。

        例1で 田中↔早稲田・鈴木↔東工大 を入れ替えると、
        鈴木（東工大第1志望）と東工大（鈴木最優先）がブロッキングペアになる。
        """
        unstable_proposer_match = [0, 1, 3, 2]  # 田中→東工大, 鈴木→早稲田（入れ替え）
        unstable_receiver_match = [[0], [1], [3], [2]]

        result = check_no_blocking_pair(
            PROPOSER_PREFS,
            RECEIVER_PREFS,
            unstable_proposer_match,
            unstable_receiver_match,
            CAPACITIES,
        )

        assert not result.passed
        assert any("ブロッキングペア" in v for v in result.violations)

    def test_unmatched_with_vacancy_is_blocking(self) -> None:
        """空き定員があるのに未マッチの提案者がいるとブロッキングペアになる。"""
        result = check_no_blocking_pair(
            [[1]],  # P1 は R1 のみ希望
            [[1]],  # R1 は P1 を受け入れ可能
            [-1],  # だが未マッチ
            [[]],
            [1],
        )

        assert not result.passed

    def test_individually_irrational_matching_detected(self) -> None:
        """選好リスト外の相手とのマッチングは個人合理性違反と判定される。"""
        result = check_individual_rationality(
            [[1]],  # P1 は R1 のみ受け入れ可能
            [[], []],  # R1・R2 とも誰も受け入れない
            [1],  # P1 → R2（双方の選好リスト外）
            [[], [0]],
        )

        assert not result.passed
        assert len(result.violations) == 2  # 提案者側と受入者側の両方で違反

    def test_capacity_violation_detected(self) -> None:
        """定員超過が検出される。"""
        result = check_capacity_compliance([[0, 1]], [1])

        assert not result.passed
        assert "定員 1 を超過" in result.violations[0]

    def test_zero_capacity_receiver_does_not_crash(self) -> None:
        """定員0の受入者（マッチなし）がいてもクラッシュせず判定できる。

        回帰テスト: 定員0の受入者には最悪マッチ相手が存在しないため、
        条件 (2b) の判定をスキップする必要がある。
        """
        result = check_no_blocking_pair(
            [[], [1]],  # P1 は受け入れ不可能（選好リスト空）、P2 は R1（定員0）を希望
            [[1, 2]],
            [-1, -1],
            [[]],
            [0],
        )

        assert result.passed  # 定員0なのでブロッキングペアは成立しない

        weak = check_weak_stability(
            [[], [1]],
            [[1, 2]],
            [-1, -1],
            [[]],
            [0],
        )
        assert weak.passed

        weak_regional = check_weak_stability(
            [[], [1]],
            [[1, 2]],
            [-1, -1],
            [[]],
            [0],
            regions=[0],
            regional_caps=[1],
        )
        assert weak_regional.passed


class TestWeakStability:
    """弱安定性（地域上限付きモデル含む）の判定。"""

    def test_regional_model_weakly_stable_but_not_stable(self) -> None:
        """fda_algorithm_exec 例2: 地域上限が binding → 安定性❌・弱安定性✅。"""
        proposer_prefs = [[1, 2], [1, 2], [2, 1], [2, 1]]
        receiver_prefs = [[1, 2, 3, 4], [3, 4, 1, 2]]
        # FDA の出力: 西村→東病院, 北川→西病院, 川上・南田は未マッチ
        proposer_match = [0, -1, 1, -1]
        receiver_match = [[0], [2]]
        max_caps = [3, 3]

        stability = check_stability(
            proposer_prefs,
            receiver_prefs,
            proposer_match,
            receiver_match,
            max_caps,
        )
        weak_stability = check_weak_stability(
            proposer_prefs,
            receiver_prefs,
            proposer_match,
            receiver_match,
            max_caps,
            regions=[0, 0],
            regional_caps=[2],
        )

        assert not stability.passed  # 空き定員へのブロッキングペアが存在
        assert weak_stability.passed  # 地域上限満員のため許容される

    def test_regional_feasibility_violation_detected(self) -> None:
        """地域上限を超えた配属は実行可能性違反と判定される。"""
        result = check_weak_stability(
            [[1], [1]],
            [[1, 2]],
            [0, 0],
            [[0, 1]],
            [2],
            regions=[0],
            regional_caps=[1],  # 地域上限1に2人配属
        )

        assert not result.passed
        assert any("実行可能性違反" in v for v in result.violations)


class TestBlockingPairsStructured:
    """CheckResult.blocking_pairs（構造化データ、#119 A-6）の検証。"""

    def test_no_blocking_pair_result_pairs_align_with_violations(self) -> None:
        """check_no_blocking_pair は違反件数と同数のブロッキングペアを返す。"""
        unstable_proposer_match = [0, 1, 3, 2]  # 田中→東工大, 鈴木→早稲田（入れ替え）
        unstable_receiver_match = [[0], [1], [3], [2]]

        result = check_no_blocking_pair(
            PROPOSER_PREFS,
            RECEIVER_PREFS,
            unstable_proposer_match,
            unstable_receiver_match,
            CAPACITIES,
        )

        assert len(result.blocking_pairs) == len(result.violations)
        assert (1, 0) in result.blocking_pairs  # 鈴木（P2）↔東工大（R1）

    def test_stable_matching_has_no_blocking_pairs(self) -> None:
        """安定マッチングのブロッキングペアは空リスト。"""
        result = check_no_blocking_pair(
            PROPOSER_PREFS,
            RECEIVER_PREFS,
            STABLE_PROPOSER_MATCH,
            STABLE_RECEIVER_MATCH,
            CAPACITIES,
        )

        assert result.blocking_pairs == []

    def test_weak_stability_omits_allowed_blocking_pairs(self) -> None:
        """弱安定性で許容されるブロッキングペアは blocking_pairs に含まれない。

        fda_algorithm_exec 例2（地域上限 binding）: 安定性違反は記録されるが、
        弱安定性では地域上限満員のため許容され blocking_pairs は空になる。
        """
        proposer_prefs = [[1, 2], [1, 2], [2, 1], [2, 1]]
        receiver_prefs = [[1, 2, 3, 4], [3, 4, 1, 2]]
        proposer_match = [0, -1, 1, -1]
        receiver_match = [[0], [2]]
        max_caps = [3, 3]

        stability = check_stability(
            proposer_prefs, receiver_prefs, proposer_match, receiver_match, max_caps
        )
        weak_stability = check_weak_stability(
            proposer_prefs,
            receiver_prefs,
            proposer_match,
            receiver_match,
            max_caps,
            regions=[0, 0],
            regional_caps=[2],
        )

        assert (1, 0) in stability.blocking_pairs  # 北川↔東病院（空き定員）
        assert weak_stability.blocking_pairs == []


class TestFairness:
    """公平性（正当な羨望なし）の判定。"""

    def test_da_output_is_fair(self) -> None:
        """DA の出力（安定マッチング）は公平と判定される。"""
        result = check_fairness(
            PROPOSER_PREFS,
            RECEIVER_PREFS,
            STABLE_PROPOSER_MATCH,
            STABLE_RECEIVER_MATCH,
        )

        assert result.passed

    def test_justified_envy_detected(self) -> None:
        """正当な羨望が検出される。

        R1 が P1 を最優先するのに P2 が R1 にマッチしていると、
        P1（R1 第1志望・未マッチ）は P2 に正当な羨望を持つ。
        """
        result = check_fairness(
            [[1], [1]],
            [[1, 2]],
            [-1, 0],
            [[1]],
        )

        assert not result.passed
        assert any("正当な羨望" in v for v in result.violations)
