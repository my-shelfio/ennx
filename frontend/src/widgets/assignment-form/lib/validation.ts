import type { AssignmentInput } from "../../../entities/assignment";

/**
 * 入力上限（バックエンドのスキーマ上限と揃える）。
 * 配属マッチングより小さいのは、くじを引く計算量が分数の成分数に対して
 * 急速に増えるため（サーバー側も同じ値で拒否する）。
 */
export const EMPLOYEE_COUNT_MAX = 24;
export const DEPARTMENT_COUNT_MAX = 8;

/**
 * 送信前のクライアント側検証。
 * サーバー側でも同じ検証を行うが、往復を待たずに直せる誤りはここで拾う。
 */
export function validateAssignmentInput(input: AssignmentInput): string[] {
  const errors: string[] = [];
  const departmentCount = input.capacities.length;

  if (input.agent_prefs.length > EMPLOYEE_COUNT_MAX) {
    errors.push(`社員数は ${EMPLOYEE_COUNT_MAX} 人までです。`);
  }
  if (departmentCount > DEPARTMENT_COUNT_MAX) {
    errors.push(`部署数は ${DEPARTMENT_COUNT_MAX} 件までです。`);
  }
  if (departmentCount === 0) {
    errors.push("部署を 1 件以上設定してください。");
  }
  if (input.agent_prefs.length === 0) {
    errors.push("社員を 1 人以上設定してください。");
  }
  if (input.capacities.some((capacity) => capacity < 0)) {
    errors.push("受け入れ人数には 0 以上の整数を入力してください。");
  }

  input.agent_prefs.forEach((prefs, index) => {
    if (prefs.length === 0) {
      errors.push(`社員${index + 1}の希望順位が未入力です。`);
      return;
    }
    if (new Set(prefs).size !== prefs.length) {
      errors.push(`社員${index + 1}の希望順位に同じ部署が重複しています。`);
    }
    if (prefs.some((department) => department < 1 || department > departmentCount)) {
      errors.push(`社員${index + 1}の希望順位に存在しない部署が含まれています。`);
    }
  });

  const totalCapacity = input.capacities.reduce((sum, capacity) => sum + capacity, 0);
  if (totalCapacity < input.agent_prefs.length) {
    errors.push(
      `受け入れ人数の合計（${totalCapacity} 人）が社員数（${input.agent_prefs.length} 人）を` +
        "下回っています。未配属になる社員が出ます。",
    );
  }
  return errors;
}
