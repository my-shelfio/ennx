import type { MatchingResult, ReportItem } from "../../../entities/matching";
import { rankOfDepartmentForEmployee } from "../../../entities/matching";

/**
 * 結果画面のサマリー指標の算出。サマリーカード
 * （マッチ数/全社員・充足率・第1希望配属率・安定性判定・平均希望順位・未配属数）と
 * 希望順位分布に対応する純粋関数。
 */
export interface SummaryMetrics {
  /** マッチした社員数。 */
  matchedCount: number;
  /** 全社員数。 */
  totalEmployees: number;
  /** マッチ率（matchedCount / totalEmployees、0〜1）。 */
  matchRate: number;
  /** 部署定員の合計。 */
  totalCapacity: number;
  /** 充足率（マッチ数 / 部署定員合計、0〜1）。定員合計が0の場合は0。 */
  capacityFillRate: number;
  /** 第1希望に配属された社員数。 */
  firstChoiceCount: number;
  /** 第1希望配属率（firstChoiceCount / totalEmployees、0〜1）。 */
  firstChoiceRate: number;
  /** 未配属の社員数（totalEmployees - matchedCount）。 */
  unmatchedCount: number;
  /**
   * 配属者の平均希望順位（1-indexed、値が小さいほど希望に近い）。
   * 配属者が0人、または配属者全員の配属先が選好リスト外（本来生じないが安全側の扱い）の
   * 場合は null。
   */
  averageAssignedRank: number | null;
  /**
   * 第k希望で配属された人数の分布。index 0 = 第1希望で配属された人数。
   * 配属先が選好リストに含まれない配属者は含まない。
   */
  rankDistribution: number[];
}

export function computeSummaryMetrics(
  result: MatchingResult,
  proposerPrefs: readonly (readonly number[])[],
): SummaryMetrics {
  const totalEmployees = result.proposer_match.length;
  const matchedCount = result.proposer_match.filter((dept) => dept !== -1).length;
  const totalCapacity = result.capacities.reduce((sum, value) => sum + value, 0);

  const firstChoiceCount = result.proposer_match.reduce((count, dept, employeeIndex) => {
    if (dept === -1) {
      return count;
    }
    const prefs = proposerPrefs[employeeIndex];
    const firstChoiceDept = prefs?.[0];
    if (firstChoiceDept !== undefined && firstChoiceDept - 1 === dept) {
      return count + 1;
    }
    return count;
  }, 0);

  const assignedRanks: number[] = [];
  result.proposer_match.forEach((dept, employeeIndex) => {
    if (dept === -1) {
      return;
    }
    const rank = rankOfDepartmentForEmployee(proposerPrefs, employeeIndex, dept);
    if (rank !== null) {
      assignedRanks.push(rank);
    }
  });

  const averageAssignedRank =
    assignedRanks.length > 0
      ? assignedRanks.reduce((sum, rank) => sum + rank, 0) / assignedRanks.length
      : null;

  const maxAssignedRank = assignedRanks.length > 0 ? Math.max(...assignedRanks) : 0;
  const rankDistribution = Array.from({ length: maxAssignedRank }, () => 0);
  assignedRanks.forEach((rank) => {
    rankDistribution[rank - 1] = (rankDistribution[rank - 1] ?? 0) + 1;
  });

  return {
    matchedCount,
    totalEmployees,
    matchRate: totalEmployees > 0 ? matchedCount / totalEmployees : 0,
    totalCapacity,
    capacityFillRate: totalCapacity > 0 ? matchedCount / totalCapacity : 0,
    firstChoiceCount,
    firstChoiceRate: totalEmployees > 0 ? firstChoiceCount / totalEmployees : 0,
    unmatchedCount: totalEmployees - matchedCount,
    averageAssignedRank,
    rankDistribution,
  };
}

/** 「安定性判定」カード向けの性質レポート項目を探す（アルゴリズムにより表示名が異なる）。 */
const STABILITY_REPORT_LABELS = ["安定性", "弱安定性", "公平性"];

export function findStabilityReportItem(
  report: readonly ReportItem[],
): ReportItem | undefined {
  return report.find((item) => STABILITY_REPORT_LABELS.includes(item.label));
}
