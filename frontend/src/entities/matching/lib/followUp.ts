import type { MatchingResult } from "../model/types";

import { buildEmployeeAssignmentRows } from "./assignment";
import type { JourneyPrefs } from "./employeeJourney";
import { buildEmployeeJourney } from "./employeeJourney";
import type { RejectionCause } from "./rejectionCause";

/** フォロー推奨のしきい値として選べる希望順位（第 N 希望以下）。 */
export const FOLLOW_UP_THRESHOLDS = [2, 3, 4, 5] as const;
export type FollowUpThreshold = (typeof FOLLOW_UP_THRESHOLDS)[number];
export const DEFAULT_FOLLOW_UP_THRESHOLD: FollowUpThreshold = 3;

/** 配属先より上位の希望 1 件（受け入れられなかった部署と理由）。 */
export interface FollowUpHigherChoice {
  department: number;
  departmentName: string;
  /** 本人の希望順位（1 始まり）。 */
  rank: number;
  cause: RejectionCause | null;
}

export interface FollowUpEmployee {
  employeeIndex: number;
  employeeName: string;
  /** 配属先（未配属は null）。 */
  departmentIndex: number | null;
  departmentName: string | null;
  /** 配属先に対する本人の希望順位（未配属・希望外は null）。 */
  rank: number | null;
  /** 第 1〜2 希望のうち受け入れられなかったもの（希望順）。 */
  topChoices: FollowUpHigherChoice[];
}

/** 希望順位を持つ行（配属先の希望順位。未配属・希望外は null）。 */
interface RankedRow {
  employeeIndex: number;
  rank: number | null;
}

/**
 * フォロー推奨の対象（第 threshold 希望以下に配属、または未配属・希望外）かどうか。
 * フォロー推奨一覧と詳細テーブルの絞り込みで同じ判定を使う。
 */
export function isFollowUpTarget(row: Pick<RankedRow, "rank">, threshold: number): boolean {
  return row.rank === null || row.rank >= threshold;
}

/**
 * 希望から遠い順（未配属・希望外 → 希望順位の降順 → 社員番号順）の比較関数。
 * フォロー推奨一覧と詳細テーブルの並べ替えで同じ順序を使う。
 */
export function compareByDistanceFromPreference(a: RankedRow, b: RankedRow): number {
  return (
    (b.rank ?? Number.POSITIVE_INFINITY) - (a.rank ?? Number.POSITIVE_INFINITY) ||
    a.employeeIndex - b.employeeIndex
  );
}

/** フォロー推奨の表示件数に含める上位希望の数（第 1〜2 希望）。 */
const TOP_CHOICE_COUNT = 2;

/**
 * 配属結果から「フォロー推奨」の社員（第 N 希望以下に配属・未配属）を抽出する。
 * 未配属・希望外配属を先頭に、以降は配属先の希望順位の降順（希望から遠い順）に並べる。
 * 第 1〜2 希望が受け入れられなかった理由も併せて返す（個別フォローの説明材料）。
 *
 * @param threshold 第 threshold 希望以下（threshold 以上の順位）を対象にする。
 */
export function extractFollowUpEmployees(
  result: MatchingResult,
  prefs: JourneyPrefs,
  threshold: number,
): FollowUpEmployee[] {
  const rows = buildEmployeeAssignmentRows(result, prefs.proposer_prefs);
  const targets = rows.filter((row) => isFollowUpTarget(row, threshold));

  return targets
    .map((row) => {
      const journey = buildEmployeeJourney(result, prefs, row.employeeIndex);
      const topChoices = journey.outcomes
        .filter((outcome) => outcome.rank <= TOP_CHOICE_COUNT && outcome.status === "rejected")
        .map((outcome) => ({
          department: outcome.department,
          departmentName:
            result.department_names[outcome.department] ?? `部署${outcome.department + 1}`,
          rank: outcome.rank,
          cause: outcome.cause,
        }));
      return {
        employeeIndex: row.employeeIndex,
        employeeName: row.employeeName,
        departmentIndex: row.departmentIndex,
        departmentName: row.departmentName,
        rank: row.rank,
        topChoices,
      };
    })
    .sort(compareByDistanceFromPreference);
}
