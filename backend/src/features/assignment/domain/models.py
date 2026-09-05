"""割り当て問題（片側選好）の共通入出力データモデル。

選好リストは外部入力では 1-indexed（対象番号 1〜M）で受け取り、内部処理と出力は
0-indexed に統一する（変換は build_rank を参照）。

matching 機能との違い:
    - 選好を申告するのは社員（agent）だけで、対象（部署・案件）は候補者を
      順位づけしない。
    - 結果は確定的なマッチングではなく、各社員が各対象を受け取る期待個数を並べた
      期待割当行列（分数）と、それを分解した純割当のくじである。

∅（未割当）の扱い:
    期待割当行列は n_objects + 1 列を持ち、最終列（index = n_objects）が ∅ に
    対応する。選好リストに載っていない対象は「∅ より下位（受け入れ不可能）」を
    意味し、正の確率で割り当てられることはない。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction

from .events import AssignmentEvent

# 期待割当行列のセル（社員 0-index, 対象 0-index）。∅ 列は n_objects。
Cell = tuple[int, int]

# 入力規模の上限。低コスト運用（Render Free 相当）の実行時間内に収めるための値で、
# presentation 層のスキーマ上限と合わせて二重に守る。
#
# マッチング（DA / FDA / CA）より小さいのは、くじを引く処理（lottery モジュール）の
# 計算量が支配的なため。抽選は分数セルが 1 つ減るごとに 1 手進むので、手数も 1 手あたりの
# 仕事量も分数セル数（最悪 社員数 × 部署数）に比例し、全体では概ねその 2 乗になる。
#
# 全員が同じ希望順位を出す最悪ケースの実測値（開発機）:
#   40 × 12 = 0.22 秒 / 50 × 15 = 0.61 秒 / 60 × 15 = 0.97 秒 / 60 × 20 = 1.73 秒
# 希望順位がばらけると分数セルは大きく減り、100 × 30 でも 0.3 秒程度で終わる。
# 上限は最悪ケースが 1 秒を切る範囲として次の値とする。
MAX_AGENTS = 50
MAX_OBJECTS = 15
MAX_UPPER_CONSTRAINTS = 200


@dataclass(frozen=True, kw_only=True)
class UpperConstraint:
    """上限制約 1 件（セル集合の和に対する上限）。

    「NG ペアを同じ案件に入れない」「案件 A の若手は最大 1 人」のような制約を、
    期待割当行列のセル集合とその和の上限で表現する。

    本モデルが扱うのは上限制約のみで、下限制約（最低◯人）は対象外とする
    （PS の獲得可能性は上限制約に対して定義されており、下限制約を課すと
    イーティングの途中で実行可能性が壊れうるため）。

    Attributes:
        cells: 制約の対象セル（社員 0-index, 対象 0-index）の集合。
            ∅ 列（index = n_objects）は含められない。
        upper: セルの和の上限（0 以上の整数）。
        label: 利用者向けの表示ラベル。
    """

    cells: frozenset[Cell]
    upper: int
    label: str = ""

    def __post_init__(self) -> None:
        if not self.cells:
            raise ValueError("上限制約の対象セルが空です")
        if self.upper < 0:
            raise ValueError(f"上限制約の上限が負です: {self.upper}")

    def display_label(self) -> str:
        """表示用ラベル（未設定なら内容から生成する）。"""
        return self.label or f"上限制約（{len(self.cells)} セルの和 ≤ {self.upper}）"


@dataclass(frozen=True, kw_only=True)
class AssignmentInput:
    """PS メカニズムの入力（片側選好・供給数・上限制約）。

    Attributes:
        agent_prefs: 社員 i の希望順位リスト（1-indexed の対象番号、好きな順）。
            リストに含まれない対象は「受け入れ不可能（∅ より下位）」を意味する。
        capacities: 対象 j の供給数（受け入れ可能な人数）。
        constraints: 追加の上限制約。空なら定員のみの素の PS と一致する。
        agent_names: 社員の表示名（省略時は "A1", "A2", ...）。
        object_names: 対象の表示名（省略時は "O1", "O2", ...）。
    """

    agent_prefs: list[list[int]]
    capacities: list[int]
    constraints: list[UpperConstraint] = field(default_factory=list)
    agent_names: list[str] | None = None
    object_names: list[str] | None = None

    def __post_init__(self) -> None:
        n_a = len(self.agent_prefs)
        n_o = len(self.capacities)
        if n_a == 0:
            raise ValueError("社員が 1 人もいません")
        if n_o == 0:
            raise ValueError("対象（部署・案件）が 1 つもありません")
        if n_a > MAX_AGENTS:
            raise ValueError(
                f"社員数が上限 {MAX_AGENTS} 人を超えています（{n_a} 人）。"
                "くじを引く計算が重くなるため、対象を絞って実行してください"
            )
        if n_o > MAX_OBJECTS:
            raise ValueError(
                f"部署数が上限 {MAX_OBJECTS} 件を超えています（{n_o} 件）。"
                "くじを引く計算が重くなるため、対象を絞って実行してください"
            )
        for i, prefs in enumerate(self.agent_prefs):
            if len(set(prefs)) != len(prefs):
                raise ValueError(f"社員 {i} の希望順位リストに重複があります: {prefs}")
            for o in prefs:
                if not 1 <= o <= n_o:
                    raise ValueError(
                        f"社員 {i} の希望順位リストに範囲外の対象番号 {o} があります"
                        f"（1〜{n_o} で指定）"
                    )
        for j, cap in enumerate(self.capacities):
            if cap < 0:
                raise ValueError(f"対象 {j} の供給数が負です: {cap}")
        if len(self.constraints) > MAX_UPPER_CONSTRAINTS:
            raise ValueError(
                f"上限制約の件数が上限 {MAX_UPPER_CONSTRAINTS} 件を超えています: "
                f"{len(self.constraints)}"
            )
        for k, constraint in enumerate(self.constraints):
            for i, j in constraint.cells:
                if not 0 <= i < n_a:
                    raise ValueError(f"上限制約 {k} に範囲外の社員 {i} が含まれています")
                if not 0 <= j < n_o:
                    raise ValueError(
                        f"上限制約 {k} に範囲外の対象 {j} が含まれています"
                        "（∅ 列には制約を課せません）"
                    )
        if self.agent_names is not None and len(self.agent_names) != n_a:
            raise ValueError("agent_names の長さが agent_prefs と一致しません")
        if self.object_names is not None and len(self.object_names) != n_o:
            raise ValueError("object_names の長さが capacities と一致しません")

    @property
    def n_agents(self) -> int:
        """社員数。"""
        return len(self.agent_prefs)

    @property
    def n_objects(self) -> int:
        """対象（部署・案件）数。∅ 列は含めない。"""
        return len(self.capacities)

    @property
    def empty_index(self) -> int:
        """∅（未割当）を表す列の 0-index。"""
        return self.n_objects

    def a_name(self, i: int) -> str:
        """社員 i（0-indexed）の表示名を返す。"""
        return self.agent_names[i] if self.agent_names else f"A{i + 1}"

    def o_name(self, j: int) -> str:
        """対象 j（0-indexed）の表示名を返す。∅ 列は "∅" を返す。"""
        if j == self.empty_index:
            return "∅"
        return self.object_names[j] if self.object_names else f"O{j + 1}"

    def acceptable(self, agent: int) -> list[int]:
        """社員 agent が受け入れ可能な対象の 0-index を好きな順に返す。

        末尾に ∅（= n_objects）を必ず付ける。選好リストに載っていない対象は
        ∅ より下位のため含めない。
        """
        return [o - 1 for o in self.agent_prefs[agent]] + [self.empty_index]


@dataclass(frozen=True, kw_only=True)
class LotteryTerm:
    """くじの 1 項（重みと純割当）。

    Attributes:
        weight: この純割当を引く確率（0 より大きい分数）。
        assignment: 純割当の整数行列（n_agents 行 × n_objects + 1 列）。
            assignment[i][j] = 1 は社員 i が対象 j に割り当てられることを表す。
    """

    weight: Fraction
    assignment: list[list[int]]

    def assigned_object(self, agent: int) -> int:
        """社員 agent の割当先の 0-index を返す（∅ のときは n_objects）。"""
        row = self.assignment[agent]
        for j, value in enumerate(row):
            if value >= 1:
                return j
        return len(row) - 1


@dataclass(frozen=True, kw_only=True)
class AssignmentResult:
    """PS メカニズムの結果（期待割当とイベントログ）。

    Attributes:
        expected_assignment: 期待割当行列（n_agents 行 × n_objects + 1 列、
            最終列が ∅）。各成分は Fraction による厳密値。
        events: イーティング過程のイベントログ（実行順）。
    """

    expected_assignment: list[list[Fraction]]
    events: list[AssignmentEvent] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class LotteryResult(AssignmentResult):
    """期待割当を純割当のくじにして配れる形にした結果。

    くじの全列挙は項数が最悪 2^(制約集合数) になり、実用規模の入力では現実的で
    ないため、常に得られるのは「1 回引いた結果」（drawn_assignment）である。
    全列挙できた場合に限り terms に全項が入り、terms_complete が True になる。

    Attributes:
        terms: くじの項（重みの降順）。全列挙できなかった場合は空リスト。
        terms_complete: terms がくじの全項かどうか。
        drawn_assignment: 抽選 1 回分の純割当（整数行列）。
        seed: 抽選に使った乱数シード。同じ入力・同じシードなら同じ結果になる。
    """

    terms: list[LotteryTerm] = field(default_factory=list)
    terms_complete: bool = False
    drawn_assignment: list[list[int]] = field(default_factory=list)
    seed: int = 0

    def drawn_object(self, agent: int) -> int:
        """抽選結果における社員 agent の割当先の 0-index を返す（∅ は列数 - 1）。"""
        row = self.drawn_assignment[agent]
        for j, value in enumerate(row):
            if value >= 1:
                return j
        return len(row) - 1


def build_rank(data: AssignmentInput) -> list[list[int]]:
    """希望順位リスト（1-indexed）を順位表（0-indexed）に変換する。

    rank[i][j] = 社員 i にとっての対象 j の順位（0 が最優先）。∅ 列を含む
    n_objects + 1 列を持ち、選好リストに載っていない対象には ∅ より大きい
    順位（= 受け入れ不可能）を与える。

    Args:
        data: 割り当て問題の入力。

    Returns:
        順位表（n_agents 行 × n_objects + 1 列）。
    """
    n_cols = data.n_objects + 1
    rank = [[n_cols] * n_cols for _ in range(data.n_agents)]
    for i in range(data.n_agents):
        for position, obj in enumerate(data.acceptable(i)):
            rank[i][obj] = position
    return rank
