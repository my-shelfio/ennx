import type { MatchingEvent, MatchingResult } from "../model/types";

import type { RejectionCause } from "./rejectionCause";
import { classifyRejectReason, isReturnToWaitlist, parseCutoffRaise } from "./rejectionCause";

/**
 * 社員 1 人分の経緯の 1 ステップ。
 * - propose: 部署に希望を出した（CA では「その部署の受け入れ対象になった」）
 * - hold: 部署に仮受入された
 * - waitlist: 部署の待機リストに入った（FDA）
 * - promote: 待機リストから繰り上げ受入された（FDA）
 * - reject: 部署に受け入れられなかった（`cause` に理由）
 * - confirm: 最終的に配属が確定した
 */
export type JourneyStepKind = "propose" | "hold" | "waitlist" | "promote" | "reject" | "confirm";

export interface JourneyStep {
  kind: JourneyStepKind;
  /** 対象の部署（0-indexed）。 */
  department: number;
  /** ラウンド（CA ではカットオフ調整の反復回）。 */
  round: number;
  /** 根拠となるイベントのインデックス（ステップ再生のステップ番号と一致）。 */
  stepIndex: number;
  /** reject の理由（それ以外は null）。 */
  cause: RejectionCause | null;
}

/** 希望した部署ごとの最終的な受け入れ可否。 */
export interface DepartmentOutcome {
  department: number;
  /** 本人の希望順位（1 始まり）。 */
  rank: number;
  /** 配属先なら "assigned"、配属先より上位の希望で受け入れられなかったなら "rejected"、配属先より下位なら "notReached"。 */
  status: "assigned" | "rejected" | "notReached";
  /** status が "rejected" のときの理由（その部署での最後の棄却）。 */
  cause: RejectionCause | null;
}

export interface EmployeeJourney {
  employee: number;
  /** 最終的な配属先（0-indexed。-1 = 未配属）。 */
  finalDepartment: number;
  /** 配属先に対する本人の希望順位（1 始まり。未配属・希望外は null）。 */
  finalRank: number | null;
  /** 時系列の経緯。 */
  steps: JourneyStep[];
  /** 希望順に並べた部署ごとの結果（希望リストに挙げた部署のみ）。 */
  outcomes: DepartmentOutcome[];
}

type JourneySource = Pick<MatchingResult, "algorithm" | "events" | "proposer_match">;

/**
 * イベントログから社員 1 人分の経緯（提案 → 仮受入 / 待機 / 棄却（理由）→ 確定 / 未配属）を組み立てる。
 *
 * DA / FDA は社員単位のイベント（propose / tentative_accept / waitlist / promote / reject）を
 * そのまま社員視点に並べる。FDA の「目標定員超過による待機リストへの差し戻し」は棄却ではなく
 * 待機への移動として扱う。
 *
 * CA はイベントに社員単位の棄却が現れない（各反復の需要 = propose、部署ごとの
 * カットオフ引き上げ = cutoff_raise、最終確定 = tentative_accept のみ）ため、
 * 「ある反復で部署の需要に含まれ、その部署のカットオフが引き上げられた結果、次の反復で
 * 需要から外れた」ことを棄却（理由: カットオフ）として導出する。希望したのに一度も需要に
 * 含まれなかった部署は、部署側の受け入れ候補外として扱う。
 *
 * @param proposerPrefs 社員→部署の希望順位（1-indexed の部署番号）。
 */
export function buildEmployeeJourney(
  result: JourneySource,
  proposerPrefs: readonly (readonly number[])[],
  employee: number,
): EmployeeJourney {
  const steps =
    result.algorithm === "ca"
      ? buildCaSteps(result.events, employee)
      : buildProposalSteps(result.events, employee);

  const finalDepartment = result.proposer_match[employee] ?? -1;
  if (finalDepartment !== -1 && result.algorithm !== "ca") {
    // DA / FDA は最終状態の仮受入がそのまま確定となるため、最後の仮受入・繰り上げを確定として追加する。
    const lastAccept = [...steps]
      .reverse()
      .find((step) => step.department === finalDepartment && (step.kind === "hold" || step.kind === "promote"));
    if (lastAccept !== undefined) {
      steps.push({ ...lastAccept, kind: "confirm", cause: null });
    }
  }

  const prefs = proposerPrefs[employee] ?? [];
  const finalRankIndex = prefs.indexOf(finalDepartment + 1);
  const outcomes = prefs.map((departmentOneIndexed, index): DepartmentOutcome => {
    const department = departmentOneIndexed - 1;
    if (department === finalDepartment) {
      return { department, rank: index + 1, status: "assigned", cause: null };
    }
    if (finalRankIndex !== -1 && index > finalRankIndex) {
      return { department, rank: index + 1, status: "notReached", cause: null };
    }
    const lastReject = [...steps]
      .reverse()
      .find((step) => step.kind === "reject" && step.department === department);
    return {
      department,
      rank: index + 1,
      status: "rejected",
      cause: lastReject?.cause ?? { kind: "unacceptable" },
    };
  });

  return {
    employee,
    finalDepartment,
    finalRank: finalRankIndex === -1 ? null : finalRankIndex + 1,
    steps,
    outcomes,
  };
}

function buildProposalSteps(events: readonly MatchingEvent[], employee: number): JourneyStep[] {
  const steps: JourneyStep[] = [];
  events.forEach((event, stepIndex) => {
    if (event.proposer !== employee) {
      return;
    }
    const base = { department: event.receiver, round: event.round, stepIndex };
    switch (event.event_type) {
      case "propose":
        steps.push({ ...base, kind: "propose", cause: null });
        return;
      case "tentative_accept":
        steps.push({ ...base, kind: "hold", cause: null });
        return;
      case "waitlist":
        steps.push({ ...base, kind: "waitlist", cause: null });
        return;
      case "promote":
        steps.push({ ...base, kind: "promote", cause: null });
        return;
      case "reject":
        // 差し戻しは直後の waitlist イベントで待機として表現されるため、棄却としては扱わない。
        if (!isReturnToWaitlist(event.reason)) {
          steps.push({ ...base, kind: "reject", cause: classifyRejectReason(event.reason) });
        }
        return;
      default:
        return;
    }
  });
  return steps;
}

function buildCaSteps(events: readonly MatchingEvent[], employee: number): JourneyStep[] {
  // 反復ごとの「この社員が需要に含まれた部署」と、部署ごとのカットオフ引き上げを集める。
  const demandByRound = new Map<number, { department: number; stepIndex: number }>();
  const raiseByRound = new Map<number, Map<number, { stepIndex: number; reason: string | null | undefined }>>();
  const confirmSteps: JourneyStep[] = [];
  let lastRound = 0;

  events.forEach((event, stepIndex) => {
    lastRound = Math.max(lastRound, event.round);
    if (event.event_type === "propose" && event.proposer === employee) {
      demandByRound.set(event.round, { department: event.receiver, stepIndex });
    } else if (event.event_type === "cutoff_raise") {
      const raises = raiseByRound.get(event.round) ?? new Map();
      raises.set(event.receiver, { stepIndex, reason: event.reason });
      raiseByRound.set(event.round, raises);
    } else if (event.event_type === "tentative_accept" && event.proposer === employee) {
      confirmSteps.push({
        kind: "confirm",
        department: event.receiver,
        round: event.round,
        stepIndex,
        cause: null,
      });
    }
  });

  const steps: JourneyStep[] = [];
  let previousDepartment = -1;
  for (let round = 1; round <= lastRound; round += 1) {
    const demand = demandByRound.get(round);
    const department = demand?.department ?? -1;
    if (demand !== undefined && department !== previousDepartment) {
      steps.push({ kind: "propose", department, round, stepIndex: demand.stepIndex, cause: null });
    }
    previousDepartment = department;

    if (demand === undefined) {
      continue;
    }
    const raise = raiseByRound.get(round)?.get(department);
    const nextDepartment = demandByRound.get(round + 1)?.department ?? -1;
    const leavesNextRound = round < lastRound && nextDepartment !== department;
    if (raise !== undefined && leavesNextRound) {
      const parsed = parseCutoffRaise(raise.reason);
      steps.push({
        kind: "reject",
        department,
        round,
        stepIndex: raise.stepIndex,
        cause:
          parsed === null
            ? { kind: "unknown", text: raise.reason ?? "" }
            : { kind: "cutoff", from: parsed.from, to: parsed.to },
      });
    }
  }
  return [...steps, ...confirmSteps];
}
