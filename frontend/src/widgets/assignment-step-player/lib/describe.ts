import type { TimelineStep } from "../../../entities/assignment";

/** ステップの見出し（時刻区間）を組み立てる。 */
export function stepHeading(step: TimelineStep): string {
  return `ステップ${step.step}: 時刻 ${step.start} → ${step.end}`;
}

/** 社員 employee がそのステップで食べていた対象の表示名を返す。 */
export function consumedLabel(
  step: TimelineStep,
  employee: number,
  departmentNames: readonly string[],
): string {
  const department = step.consumption[employee];
  if (department === undefined || department < 0) {
    return "未配属（∅）";
  }
  return departmentNames[department] ?? `部署${department + 1}`;
}
