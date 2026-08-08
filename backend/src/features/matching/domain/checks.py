"""マッチング結果の性質検証ユーティリティ。

print 出力を廃止し、CheckResult を返す純粋関数としてテストから利用できるようにした。

検証する性質:
  1. 個人合理性   （Individual Rationality）
  2. 定員遵守     （Capacity Compliance）
  3. ブロッキングペアなし（No Blocking Pair）
  4. 安定性       （Stability）= 個人合理性 + ブロッキングペアなし
  5. 弱安定性     （Weak Stability）= 個人合理性 + 強ブロッキングペアなし
     （regions / regional_caps 指定時は地域上限付きモデルの定義で判定）
  6. 公平性       （Fairness）= 正当な羨望を持つ提案者がいない

入力形式（全関数共通、models モジュールと同じ規約）:
  proposer_prefs : 提案者 i の選好リスト（1-indexed の受入者番号）
  receiver_prefs : 受入者 j の優先順位リスト（1-indexed の提案者番号）
  proposer_match : proposer_match[i] = マッチした受入者の 0-index（-1 = 未マッチ）
  receiver_match : receiver_match[j] = マッチした提案者の 0-index リスト
  capacities     : 受入者 j の定員（省略時は全員 1 とみなす）
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .models import build_rank


@dataclass(frozen=True, kw_only=True)
class CheckResult:
    """性質検証の結果。

    Attributes:
        passed: 性質が成立していれば True。
        violations: 違反の説明（成立時は空リスト）。
        blocking_pairs: 安定性違反の原因となったブロッキングペア（提案者 0-index,
            受入者 0-index）の一覧。ブロッキングペアを扱わない検証関数、または
            違反なしの場合は空リスト。
    """

    passed: bool
    violations: list[str] = field(default_factory=list)
    blocking_pairs: list[tuple[int, int]] = field(default_factory=list)

    def __bool__(self) -> bool:
        return self.passed


def _pn(names: list[str] | None, i: int) -> str:
    """提案者 i の表示名を返す。"""
    return names[i] if names else f"P{i + 1}"


def _rn(names: list[str] | None, j: int) -> str:
    """受入者 j の表示名を返す。"""
    return names[j] if names else f"R{j + 1}"


def _prefers(rank: list[list[int]], agent: int, a: int, b: int, unmatched_rank: int) -> bool:
    """agent が b よりも a を厳密に好むかどうか（順位が小さいほど好ましい）。

    a または b が -1（未マッチ）の場合は unmatched_rank を使う。
    """
    rank_a = rank[agent][a] if a != -1 else unmatched_rank
    rank_b = rank[agent][b] if b != -1 else unmatched_rank
    return rank_a < rank_b


def check_individual_rationality(
    proposer_prefs: list[list[int]],
    receiver_prefs: list[list[int]],
    proposer_match: list[int],
    receiver_match: list[list[int]],
    proposer_names: list[str] | None = None,
    receiver_names: list[str] | None = None,
) -> CheckResult:
    """個人合理性（Individual Rationality）を検証する。

    各エージェントが自分のマッチ相手を「受け入れ可能」と判断していること。
    選好リストに含まれない相手とのマッチングは違反とする。

    計算量: O(P + R + マッチ数)
    """
    violations: list[str] = []

    for p, r in enumerate(proposer_match):
        if r == -1:
            continue  # 未マッチは個人合理性に反しない
        if (r + 1) not in proposer_prefs[p]:
            violations.append(
                f"{_pn(proposer_names, p)} が受け入れ不可能な "
                f"{_rn(receiver_names, r)} とマッチしている"
            )

    for r, matched in enumerate(receiver_match):
        acceptable = set(receiver_prefs[r])
        for p in matched:
            if (p + 1) not in acceptable:
                violations.append(
                    f"{_rn(receiver_names, r)} が受け入れ不可能な "
                    f"{_pn(proposer_names, p)} とマッチしている"
                )

    return CheckResult(passed=not violations, violations=violations)


def check_capacity_compliance(
    receiver_match: list[list[int]],
    capacities: list[int],
    receiver_names: list[str] | None = None,
) -> CheckResult:
    """定員遵守（Capacity Compliance）を検証する。

    各受入者のマッチ数が定員以下であること。

    計算量: O(R)
    """
    violations: list[str] = []
    for r, matched in enumerate(receiver_match):
        if len(matched) > capacities[r]:
            violations.append(
                f"{_rn(receiver_names, r)} のマッチ数 {len(matched)} が"
                f"定員 {capacities[r]} を超過している"
            )
    return CheckResult(passed=not violations, violations=violations)


def check_no_blocking_pair(
    proposer_prefs: list[list[int]],
    receiver_prefs: list[list[int]],
    proposer_match: list[int],
    receiver_match: list[list[int]],
    capacities: list[int] | None = None,
    proposer_names: list[str] | None = None,
    receiver_names: list[str] | None = None,
) -> CheckResult:
    """ブロッキングペアが存在しないことを検証する（安定性の核心条件）。

    ブロッキングペア (p, r) の条件（以下を両方満たすペア）:
      (1) 提案者 p が受け入れ可能な受入者 r を現在の相手よりも厳密に好む
      (2) 受入者 r が提案者 p を受け入れ可能かつ以下のいずれかを満たす:
          (a) r の定員に空きがある（|μ(r)| < q_r）
          (b) r が p を現在の最悪マッチ相手より厳密に好む

    計算量: O(P × R)
    """
    n_proposers = len(proposer_match)
    n_receivers = len(receiver_match)

    if capacities is None:
        capacities = [1] * n_receivers

    p_rank = build_rank(proposer_prefs, n_receivers)
    r_rank = build_rank(receiver_prefs, n_proposers)

    violations: list[str] = []
    blocking_pairs: list[tuple[int, int]] = []

    for p in range(n_proposers):
        current_r = proposer_match[p]

        for r in range(n_receivers):
            # r が p の選好リストにない → p は r を受け入れ不可能
            if (r + 1) not in proposer_prefs[p]:
                continue

            # 条件 (1): p が r を現在の相手より厳密に好む
            if not _prefers(p_rank, p, r, current_r, n_receivers):
                continue

            # p が r の優先順位リストにない → r は p を受け入れ不可能
            if (p + 1) not in receiver_prefs[r]:
                continue

            # 条件 (2a): r の定員に空きがある
            if len(receiver_match[r]) < capacities[r]:
                violations.append(
                    f"ブロッキングペア ({_pn(proposer_names, p)}, {_rn(receiver_names, r)}): "
                    f"{_pn(proposer_names, p)} は {_rn(receiver_names, r)} を希望し、"
                    f"{_rn(receiver_names, r)} には空き定員がある"
                )
                blocking_pairs.append((p, r))
                continue

            # 条件 (2b): r が p を現在の最悪マッチ相手より厳密に好む
            # （定員0で誰ともマッチしていない受入者には最悪マッチ相手が存在しない）
            if not receiver_match[r]:
                continue
            rank_r = r_rank[r]
            worst_q = max(receiver_match[r], key=rank_r.__getitem__)
            if _prefers(r_rank, r, p, worst_q, n_proposers):
                violations.append(
                    f"ブロッキングペア ({_pn(proposer_names, p)}, {_rn(receiver_names, r)}): "
                    f"{_rn(receiver_names, r)} は最悪マッチ {_pn(proposer_names, worst_q)} より "
                    f"{_pn(proposer_names, p)} を優先する"
                )
                blocking_pairs.append((p, r))

    return CheckResult(passed=not violations, violations=violations, blocking_pairs=blocking_pairs)


def check_stability(
    proposer_prefs: list[list[int]],
    receiver_prefs: list[list[int]],
    proposer_match: list[int],
    receiver_match: list[list[int]],
    capacities: list[int] | None = None,
    proposer_names: list[str] | None = None,
    receiver_names: list[str] | None = None,
) -> CheckResult:
    """安定性（Stability）= 個人合理性 + ブロッキングペアなし を検証する。

    計算量: O(P × R)
    """
    ir = check_individual_rationality(
        proposer_prefs,
        receiver_prefs,
        proposer_match,
        receiver_match,
        proposer_names,
        receiver_names,
    )
    nbp = check_no_blocking_pair(
        proposer_prefs,
        receiver_prefs,
        proposer_match,
        receiver_match,
        capacities,
        proposer_names,
        receiver_names,
    )

    violations = ir.violations + nbp.violations
    return CheckResult(
        passed=not violations, violations=violations, blocking_pairs=nbp.blocking_pairs
    )


def check_weak_stability(
    proposer_prefs: list[list[int]],
    receiver_prefs: list[list[int]],
    proposer_match: list[int],
    receiver_match: list[list[int]],
    capacities: list[int] | None = None,
    proposer_names: list[str] | None = None,
    receiver_names: list[str] | None = None,
    *,
    regions: list[int] | None = None,
    regional_caps: list[int] | None = None,
) -> CheckResult:
    """弱安定性（Weak Stability）を検証する。

    【regions / regional_caps を指定した場合】地域上限付きモデルの定義で判定する。
      弱安定性 = 実行可能性 + 個人合理性 + 「許容されないブロッキングペアなし」
      ブロッキングペア (p, r) が許容されるのは次の2条件が両方成り立つときのみ:
        (a) 受入数の条件: r の所在地域が地域上限と同数で満員
        (b) 選好の条件  : r は現在採用中のすべての提案者を p より好む
      ※ capacities には設置上限（物理上限）を渡すこと。

    【regions 未指定の場合】地域情報なしの簡易判定:
      弱安定性 = 個人合理性 + 強ブロッキングペアなし
      強ブロッキングペア = 受入者が定員満杯かつ p を最悪マッチ相手より厳密に好むペア

    計算量: O(P × R)
    """
    n_proposers = len(proposer_match)
    n_receivers = len(receiver_match)

    if capacities is None:
        capacities = [1] * n_receivers

    use_regional = regions is not None and regional_caps is not None

    ir = check_individual_rationality(
        proposer_prefs,
        receiver_prefs,
        proposer_match,
        receiver_match,
        proposer_names,
        receiver_names,
    )

    p_rank = build_rank(proposer_prefs, n_receivers)
    r_rank = build_rank(receiver_prefs, n_proposers)

    violations: list[str] = list(ir.violations)
    blocking_pairs: list[tuple[int, int]] = []

    # 実行可能性（地域上限）の確認【地域対応】
    regional_count: list[int] = []
    if use_regional:
        assert regions is not None and regional_caps is not None
        regional_count = [0] * len(regional_caps)
        for r, matched in enumerate(receiver_match):
            regional_count[regions[r]] += len(matched)
        for k, cnt in enumerate(regional_count):
            if cnt > regional_caps[k]:
                violations.append(
                    f"実行可能性違反: 地域{k} の配属数 {cnt} が地域上限 {regional_caps[k]} を超過"
                )

    for p in range(n_proposers):
        current_r = proposer_match[p]

        for r in range(n_receivers):
            # r が p の選好リストにない → p は r を受け入れ不可能
            if (r + 1) not in proposer_prefs[p]:
                continue

            # 条件 (1): p が r を厳密に好む
            if not _prefers(p_rank, p, r, current_r, n_receivers):
                continue

            # p が r の優先順位リストにない → r は p を受け入れ不可能
            if (p + 1) not in receiver_prefs[r]:
                continue

            rank_r = r_rank[r]

            if use_regional:
                assert regions is not None and regional_caps is not None
                # ブロッキングペアか（空き定員がある or 最悪マッチ相手より p を好む）
                if len(receiver_match[r]) < capacities[r]:
                    blocking = True
                elif not receiver_match[r]:
                    blocking = False  # 定員0でマッチなし → 最悪マッチ相手が存在しない
                else:
                    worst_q = max(receiver_match[r], key=rank_r.__getitem__)
                    blocking = _prefers(r_rank, r, p, worst_q, n_proposers)
                if not blocking:
                    continue

                # 許容条件 (a) 受入数の条件: 地域上限で満員
                region = regions[r]
                region_full = regional_count[region] >= regional_caps[region]
                # 許容条件 (b) 選好の条件: 現採用者全員を p より好む
                prefers_all = all(rank_r[q] < rank_r[p] for q in receiver_match[r])
                if region_full and prefers_all:
                    continue  # 許容されるブロッキングペア（弱安定性は保たれる）

                if not region_full:
                    detail = f"地域{region}の上限（{regional_caps[region]}人）に達していない"
                else:
                    detail = (
                        f"{_rn(receiver_names, r)} は採用中の提案者より "
                        f"{_pn(proposer_names, p)} を優先する"
                    )
                violations.append(
                    f"弱安定性違反 ({_pn(proposer_names, p)}, {_rn(receiver_names, r)}): "
                    f"ブロッキングペアが許容されない — {detail}"
                )
                blocking_pairs.append((p, r))
                continue

            # ─── 以下、regions 未指定時の簡易判定 ───
            # 空き定員がある場合は強ブロッキングとしない（弱安定性の核心）
            if len(receiver_match[r]) < capacities[r]:
                continue

            # 定員0で誰ともマッチしていない受入者には最悪マッチ相手が存在しない
            if not receiver_match[r]:
                continue

            # 条件 (2): 定員満杯かつ r が p を最悪マッチ相手より厳密に好む
            worst_q = max(receiver_match[r], key=rank_r.__getitem__)
            if _prefers(r_rank, r, p, worst_q, n_proposers):
                violations.append(
                    f"強ブロッキングペア ({_pn(proposer_names, p)}, {_rn(receiver_names, r)}): "
                    f"{_rn(receiver_names, r)} は最悪マッチ {_pn(proposer_names, worst_q)} より "
                    f"{_pn(proposer_names, p)} を厳密に優先する"
                )
                blocking_pairs.append((p, r))

    return CheckResult(passed=not violations, violations=violations, blocking_pairs=blocking_pairs)


def check_fairness(
    proposer_prefs: list[list[int]],
    receiver_prefs: list[list[int]],
    proposer_match: list[int],
    receiver_match: list[list[int]],
    proposer_names: list[str] | None = None,
    receiver_names: list[str] | None = None,
) -> CheckResult:
    """公平性（Fairness）= 正当な羨望を持つ提案者がいないことを検証する。

    以下の2条件を同時に満たす提案者ペア (i, j) が存在しないこと:
      (1) 提案者 i が、提案者 j のマッチ相手 s = μ(j) を自分の相手 μ(i) より好む
      (2) 受入者 s も、j より i を優先する

    計算量: O(P² )
    """
    n_proposers = len(proposer_match)
    n_receivers = len(receiver_match)

    p_rank = build_rank(proposer_prefs, n_receivers)
    r_rank = build_rank(receiver_prefs, n_proposers)

    violations: list[str] = []

    for i in range(n_proposers):
        current_i = proposer_match[i]

        for j in range(n_proposers):
            if i == j:
                continue
            s = proposer_match[j]
            if s == -1:
                continue  # j が未マッチなら羨望の対象にならない

            # i が s を選好リストに持たない → 羨望の対象外
            if (s + 1) not in proposer_prefs[i]:
                continue

            # 条件 (1): i が s = μ(j) を μ(i) より好む
            if not _prefers(p_rank, i, s, current_i, n_receivers):
                continue

            # 条件 (2): 受入者 s が j より i を優先する
            if (i + 1) not in receiver_prefs[s]:
                continue
            if _prefers(r_rank, s, i, j, n_proposers):
                current_label = "未マッチ" if current_i == -1 else _rn(receiver_names, current_i)
                violations.append(
                    f"正当な羨望: {_pn(proposer_names, i)}（現在: {current_label}）が "
                    f"{_pn(proposer_names, j)}（→{_rn(receiver_names, s)}）を羨む — "
                    f"{_rn(receiver_names, s)} も {_pn(proposer_names, j)} より "
                    f"{_pn(proposer_names, i)} を優先"
                )

    return CheckResult(passed=not violations, violations=violations)
