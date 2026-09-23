import type {
  DepartmentOutcome,
  EmployeeJourney,
  JourneyStep,
  JourneyStepKind,
} from "../../../entities/matching";
import { describeRejectionCause } from "../../../entities/matching";

/** 経緯の説明文（要約）。 */
export interface JourneySummary {
  /** 結論の 1 文（どこに配属されたか / 未配属か）。 */
  headline: string;
  /** 配属先より上位の希望（未配属なら全希望）が受け入れられなかった理由の文。希望順。 */
  reasons: string[];
}

function nameOf(names: readonly string[], index: number, prefix: string): string {
  return names[index] ?? `${prefix}${index + 1}`;
}

function reasonSentence(outcome: DepartmentOutcome, departmentName: string): string {
  const cause = outcome.cause ?? { kind: "unacceptable" as const };
  const target = `第${outcome.rank}希望の${departmentName}`;
  if (cause.kind === "unknown") {
    const detail = cause.text === "" ? "" : `（${cause.text}）`;
    return `${target}には受け入れられませんでした${detail}。`;
  }
  return `${target}は、${describeRejectionCause(cause)}ため、受け入れられませんでした。`;
}

/**
 * 社員 1 人分の経緯を、本人や上長への説明にそのまま使える日本語の要約にする。
 */
export function buildJourneySummary(
  journey: EmployeeJourney,
  employeeNames: readonly string[],
  departmentNames: readonly string[],
): JourneySummary {
  const employeeName = nameOf(employeeNames, journey.employee, "社員");
  const reasons = journey.outcomes
    .filter((outcome) => outcome.status === "rejected")
    .map((outcome) => reasonSentence(outcome, nameOf(departmentNames, outcome.department, "部署")));

  if (journey.finalDepartment === -1) {
    const headline =
      journey.outcomes.length === 0
        ? `${employeeName}は希望する部署がないため、未配属です。`
        : `${employeeName}は未配属です。希望したすべての部署で受け入れられませんでした。`;
    return { headline, reasons };
  }

  const departmentName = nameOf(departmentNames, journey.finalDepartment, "部署");
  if (journey.finalRank === null) {
    return { headline: `${employeeName}は${departmentName}に配属されました。`, reasons };
  }
  const suffix = journey.finalRank === 1 ? "（第1希望どおり）" : "";
  return {
    headline: `${employeeName}は第${journey.finalRank}希望の${departmentName}に配属されました${suffix}。`,
    reasons,
  };
}

const STEP_LABELS: Record<JourneyStepKind, string> = {
  propose: "希望",
  hold: "仮受入",
  waitlist: "待機",
  promote: "繰り上げ受入",
  reject: "棄却",
  confirm: "確定",
};

/** 経緯の 1 ステップを時系列表示用の見出しと説明文にする。 */
export function describeJourneyStep(
  step: JourneyStep,
  departmentNames: readonly string[],
  algorithm: string,
): { label: string; detail: string } {
  const departmentName = nameOf(departmentNames, step.department, "部署");
  const label = STEP_LABELS[step.kind];
  switch (step.kind) {
    case "propose":
      return {
        label,
        detail:
          algorithm === "ca"
            ? `${departmentName}の受け入れ対象に入りました（カットオフを通過した部署のうち最も希望が高い部署）。`
            : `${departmentName}に希望を出しました。`,
      };
    case "hold":
      return { label, detail: `${departmentName}に仮受入されました。` };
    case "waitlist":
      return { label, detail: `${departmentName}の待機リストに入りました。` };
    case "promote":
      return { label, detail: `${departmentName}の待機リストから繰り上げで受け入れられました。` };
    case "reject": {
      const cause = step.cause ?? { kind: "unknown" as const, text: "" };
      return {
        label,
        detail:
          cause.kind === "unknown"
            ? `${departmentName}に受け入れられませんでした${cause.text === "" ? "" : `（${cause.text}）`}。`
            : `${describeRejectionCause(cause, departmentName)}。`,
      };
    }
    case "confirm":
      return { label, detail: `${departmentName}への配属が確定しました。` };
  }
}
