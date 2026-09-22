import type { MatchingResult } from "../model/types";

import { buildEmployeeJourney } from "./employeeJourney";
import type { RejectionCause } from "./rejectionCause";

/**
 * 部署を希望した社員 1 人分の、その部署から見た結果。
 * - accepted: この部署に配属された
 * - rejected: この部署を希望したが受け入れられなかった（`cause` に理由）
 * - placedHigher: この部署より上位に希望した別の部署に配属された（この部署の判断は関係しない）
 */
export interface DepartmentApplicant {
  employee: number;
  status: "accepted" | "rejected" | "placedHigher";
  /** 部署側の優先順位（1 始まり。部署の優先順位リストに含まれない場合は null）。 */
  priorityRank: number | null;
  /** 社員側の、この部署に対する希望順位（1 始まり）。 */
  preferenceRank: number;
  /** status が "rejected" のときの理由。 */
  cause: RejectionCause | null;
}

/** カットオフ調整（CA）の最終カットオフを部署の優先順位で読み替えたもの。 */
export interface DepartmentCutoff {
  /** アルゴリズム内部のカットオフ値（1 で全員が対象、社員数 + 1 で全員が対象外）。 */
  value: number;
  /** 受け入れ対象になる部署側の優先順位の上限（上位 N 位まで）。0 のときは誰も対象外。 */
  passRankLimit: number;
}

export interface DepartmentBreakdown {
  department: number;
  /** この部署を希望した社員（部署側の優先順位順。優先順位リスト外の社員は末尾）。 */
  applicants: DepartmentApplicant[];
  /** CA のみ。その他のアルゴリズムでは null。 */
  cutoff: DepartmentCutoff | null;
}

type BreakdownSource = Pick<MatchingResult, "algorithm" | "events" | "proposer_match" | "cutoff">;

/**
 * 部署視点の受入・棄却の内訳を導出する。
 * 部署を希望した社員（社員側の希望リストにその部署がある社員）ごとに、社員の経緯
 * （{@link buildEmployeeJourney}）からその部署での結果と棄却理由を取り出し、
 * 部署側の優先順位で並べる。
 *
 * CA の最終カットオフ c は「部署の優先順位が上位 (社員数 − c + 1) 位以内の社員だけを
 * 受け入れ対象にする」ことを意味するため、表示用にその順位へ読み替えて返す。
 *
 * @param proposerPrefs 社員→部署の希望順位（1-indexed の部署番号）。
 * @param receiverPrefs 部署→社員の優先順位（1-indexed の社員番号）。
 */
export function buildDepartmentBreakdown(
  result: BreakdownSource,
  proposerPrefs: readonly (readonly number[])[],
  receiverPrefs: readonly (readonly number[])[],
  department: number,
): DepartmentBreakdown {
  const journeyPrefs = { proposer_prefs: proposerPrefs, receiver_prefs: receiverPrefs };
  const priorities = receiverPrefs[department] ?? [];
  const applicants: DepartmentApplicant[] = [];

  proposerPrefs.forEach((prefs, employee) => {
    const preferenceIndex = prefs.indexOf(department + 1);
    if (preferenceIndex === -1) {
      return;
    }
    const outcome = buildEmployeeJourney(result, journeyPrefs, employee).outcomes.find(
      (candidate) => candidate.department === department,
    );
    const priorityIndex = priorities.indexOf(employee + 1);
    applicants.push({
      employee,
      status:
        outcome?.status === "assigned"
          ? "accepted"
          : outcome?.status === "notReached"
            ? "placedHigher"
            : "rejected",
      priorityRank: priorityIndex === -1 ? null : priorityIndex + 1,
      preferenceRank: preferenceIndex + 1,
      cause: outcome?.status === "rejected" ? outcome.cause : null,
    });
  });

  applicants.sort(
    (a, b) =>
      (a.priorityRank ?? Number.POSITIVE_INFINITY) - (b.priorityRank ?? Number.POSITIVE_INFINITY) ||
      a.employee - b.employee,
  );

  const cutoffValue = result.algorithm === "ca" ? result.cutoff[department] : undefined;
  const cutoff =
    cutoffValue === undefined
      ? null
      : {
          value: cutoffValue,
          passRankLimit: Math.max(0, proposerPrefs.length - cutoffValue + 1),
        };

  return { department, applicants, cutoff };
}
