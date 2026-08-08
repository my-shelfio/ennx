"""投票ルールの集計（純粋関数）。

すべての関数は入力モデル → RuleResult の変換のみを行い、
print・グローバル状態・乱数を持たない（同一入力で同一結果）。
"""

from __future__ import annotations

from .models import ApprovalTallyInput, ChoiceTallyInput, RankingTallyInput, RuleResult


def _build_result(rule: str, scores: list[float]) -> RuleResult:
    """スコア列から順位（降順・同点はインデックス昇順）と勝者集合を組み立てる。"""
    ranking = sorted(range(len(scores)), key=lambda option: (-scores[option], option))
    top = max(scores)
    winners = [option for option, score in enumerate(scores) if score == top]
    return RuleResult(rule=rule, scores=scores, ranking=ranking, winners=winners)


def tally_plurality(tally_input: ChoiceTallyInput) -> RuleResult:
    """多数決（単純多数）: 得票数の多い選択肢を上位とする。"""
    scores = [0.0] * tally_input.num_options
    for choice in tally_input.choices:
        scores[choice] += 1.0
    return _build_result("plurality", scores)


def first_choices(tally_input: RankingTallyInput) -> ChoiceTallyInput:
    """順位付け投票の第 1 希望のみを取り出し、多数決の入力に変換する。"""
    return ChoiceTallyInput(
        num_options=tally_input.num_options,
        choices=[ranking[0] for ranking in tally_input.rankings],
    )


def tally_borda(tally_input: RankingTallyInput) -> RuleResult:
    """ボルダ方式: 順位 k（0 始まり）の選択肢に (選択肢数 - 1 - k) 点を与える。"""
    n = tally_input.num_options
    scores = [0.0] * n
    for ranking in tally_input.rankings:
        for position, option in enumerate(ranking):
            scores[option] += float(n - 1 - position)
    return _build_result("borda", scores)


def tally_approval(tally_input: ApprovalTallyInput) -> RuleResult:
    """承認投票: 承認された数の多い選択肢を上位とする。"""
    scores = [0.0] * tally_input.num_options
    for approval in tally_input.approvals:
        for option in approval:
            scores[option] += 1.0
    return _build_result("approval", scores)


def pairwise_matrix(tally_input: RankingTallyInput) -> list[list[int]]:
    """ペアワイズ比較行列を返す。matrix[a][b] = a を b より上位に置いた投票数。"""
    n = tally_input.num_options
    matrix = [[0] * n for _ in range(n)]
    for ranking in tally_input.rankings:
        position = {option: index for index, option in enumerate(ranking)}
        for a in range(n):
            for b in range(n):
                if a != b and position[a] < position[b]:
                    matrix[a][b] += 1
    return matrix


def condorcet_winner(tally_input: RankingTallyInput) -> int | None:
    """コンドルセ勝者（他の全選択肢との 1 対 1 比較で過半数勝ちする選択肢）を返す。

    存在しない場合（循環など）は None。
    """
    n = tally_input.num_options
    matrix = pairwise_matrix(tally_input)
    for a in range(n):
        if all(matrix[a][b] > matrix[b][a] for b in range(n) if b != a):
            return a
    return None


def tally_condorcet(tally_input: RankingTallyInput) -> RuleResult:
    """コンドルセ方式（Copeland スコアによる順位付け）。

    スコアはペアワイズ比較の勝ち数（引き分けは 0.5）。コンドルセ勝者が
    存在する場合、その選択肢が必ず単独最高スコアになる。
    """
    n = tally_input.num_options
    matrix = pairwise_matrix(tally_input)
    scores = [0.0] * n
    for a in range(n):
        for b in range(n):
            if a == b:
                continue
            if matrix[a][b] > matrix[b][a]:
                scores[a] += 1.0
            elif matrix[a][b] == matrix[b][a]:
                scores[a] += 0.5
    return _build_result("condorcet", scores)
