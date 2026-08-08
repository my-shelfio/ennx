import type { MatchingInput } from "../../../entities/matching";

export type WizardStepId = "scale" | "constraint" | "names" | "detail";

// Stepper（shared/ui）の props（StepperStep[]、readonly でない配列）にそのまま渡せるよう
// mutable な配列型で定義する。
export const WIZARD_STEPS: { id: WizardStepId; label: string }[] = [
  { id: "scale", label: "規模" },
  { id: "constraint", label: "制約種別" },
  { id: "names", label: "名前" },
  { id: "detail", label: "詳細" },
];

/** 入力が初期状態（未入力）かどうかを判定する。 */
export function isEmptyMatchingInput(input: MatchingInput): boolean {
  return (
    input.constraint_type === "" &&
    input.capacities.length === 0 &&
    input.proposer_prefs.length === 0 &&
    input.receiver_prefs.length === 0
  );
}

/**
 * 保存済みの入力から、再開すべきウィザードのステップを推定する
 * （「前回の続きから再開しますか？」の確認に使う）。
 *
 * ウィザードは「最後に完了したステップ」を明示的に保存しないため
 * （store.ts の MatchingInput はサーバー送信用の形式そのままで、ウィザード固有の
 * 状態を混入させない）、入力内容の充足度から逆算する。
 * - 規模（部署数・社員数）が未入力 → "scale"
 * - 規模は入力済みだが制約種別が未選択 → "constraint"
 * - 制約種別まで選択済み → "detail"（名前・定員等の詳細は再開後に確認・修正できる。
 *   「名前」ステップは任意入力のため、未確認でも "detail" から進めれば結果には影響しない）
 */
export function resolveResumeStep(input: MatchingInput): WizardStepId {
  const hasScale = input.capacities.length > 0 && input.proposer_prefs.length > 0;
  if (!hasScale) {
    return "scale";
  }
  if (input.constraint_type === "") {
    return "constraint";
  }
  return "detail";
}
