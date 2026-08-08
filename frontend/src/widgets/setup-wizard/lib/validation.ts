/**
 * 設定ウィザードのインライン検証。
 * すべて純粋関数とし、フォーム状態から独立してテストできるようにする。
 * 上限値（DEPARTMENT_COUNT_MAX / EMPLOYEE_COUNT_MAX）は features/import-input
 * （CSV一括インポートの上限超過チェック）とも共有するため entities/matching/lib/limits
 * に定義したものをそのまま再エクスポートする。
 */
import { DEPARTMENT_COUNT_MAX, EMPLOYEE_COUNT_MAX } from "../../../entities/matching";

export { DEPARTMENT_COUNT_MAX, EMPLOYEE_COUNT_MAX };

export interface ScaleStepErrors {
  departmentCount?: string;
  employeeCount?: string;
}

/** ステップ1（規模）のインライン検証。null は未入力を表す。 */
export function validateScaleStep(
  departmentCount: number | null,
  employeeCount: number | null,
): ScaleStepErrors {
  const errors: ScaleStepErrors = {};

  const departmentError = validateCount(departmentCount, DEPARTMENT_COUNT_MAX, "部署数");
  if (departmentError !== undefined) {
    errors.departmentCount = departmentError;
  }

  const employeeError = validateCount(employeeCount, EMPLOYEE_COUNT_MAX, "社員数");
  if (employeeError !== undefined) {
    errors.employeeCount = employeeError;
  }

  return errors;
}

function validateCount(value: number | null, max: number, label: string): string | undefined {
  if (value === null || Number.isNaN(value)) {
    return `${label}を入力してください。`;
  }
  if (!Number.isInteger(value)) {
    return `${label}は整数で入力してください。`;
  }
  if (value < 1) {
    return `${label}は1以上で入力してください。`;
  }
  if (value > max) {
    return `${label}は${max}以下で入力してください。`;
  }
  return undefined;
}

/** 定員（capacities）の各要素を検証し、要素番号 → エラーメッセージの Record を返す。 */
export function validateCapacities(
  capacities: readonly (number | null)[],
): Record<number, string> {
  const errors: Record<number, string> = {};
  capacities.forEach((value, index) => {
    if (value === null || Number.isNaN(value)) {
      errors[index] = "定員を入力してください。";
    } else if (!Number.isInteger(value) || value < 0) {
      errors[index] = "0以上の整数で入力してください。";
    }
  });
  return errors;
}

/**
 * capacities（部署ごとの定員）の合計値。
 * 未入力（null）が含まれる場合は 0 として扱う。
 */
export function sumCapacities(capacities: readonly (number | null)[]): number {
  return capacities.reduce<number>((total, value) => total + (value ?? 0), 0);
}

/** 社員数が定員合計を超えているかどうか（続行可能な警告）。 */
export function isCapacitySumBelowEmployeeCount(
  capacities: readonly (number | null)[],
  employeeCount: number,
): boolean {
  return sumCapacities(capacities) < employeeCount;
}

/** FDA（regional_cap）: 設置上限は目標定員以上でなければならない。 */
export function validateMaxCaps(
  capacities: readonly (number | null)[],
  maxCaps: readonly (number | null)[],
): Record<number, string> {
  const errors: Record<number, string> = {};
  maxCaps.forEach((value, index) => {
    if (value === null || Number.isNaN(value)) {
      errors[index] = "設置上限を入力してください。";
      return;
    }
    if (!Number.isInteger(value) || value < 0) {
      errors[index] = "0以上の整数で入力してください。";
      return;
    }
    const capacity = capacities[index] ?? null;
    if (capacity !== null && value < capacity) {
      errors[index] = "設置上限は目標定員以上で入力してください。";
    }
  });
  return errors;
}

/** FDA（regional_cap）: 地域番号（0-indexed）は 0 以上 regionCount 未満でなければならない。 */
export function validateRegions(
  regions: readonly (number | null)[],
  regionCount: number,
): Record<number, string> {
  const errors: Record<number, string> = {};
  regions.forEach((value, index) => {
    if (value === null || Number.isNaN(value)) {
      errors[index] = "地域を選択してください。";
      return;
    }
    if (!Number.isInteger(value) || value < 0 || value >= regionCount) {
      errors[index] = "地域は一覧から選択してください。";
    }
  });
  return errors;
}

/** FDA（regional_cap）: 地域上限（regionalCaps）の各要素の検証。 */
export function validateRegionalCaps(
  regionalCaps: readonly (number | null)[],
): Record<number, string> {
  const errors: Record<number, string> = {};
  regionalCaps.forEach((value, index) => {
    if (value === null || Number.isNaN(value)) {
      errors[index] = "地域上限を入力してください。";
    } else if (!Number.isInteger(value) || value < 0) {
      errors[index] = "0以上の整数で入力してください。";
    }
  });
  return errors;
}

/**
 * FDA の実行可能性の前提条件: 各地域について
 * 「目標定員の合計 ≤ 地域上限」。違反時は地域ごとのエラーメッセージを返す
 * （API validate でも検証されるが、送信前にクライアント側でも検知しておく）。
 */
export function validateRegionalCapacitySums(
  capacities: readonly (number | null)[],
  regions: readonly (number | null)[],
  regionalCaps: readonly (number | null)[],
): string | undefined {
  const sumByRegion = new Map<number, number>();
  regions.forEach((region, index) => {
    if (region === null || !Number.isInteger(region)) {
      return;
    }
    const capacity = capacities[index];
    const sum = sumByRegion.get(region) ?? 0;
    sumByRegion.set(region, sum + (capacity ?? 0));
  });

  for (const [region, sum] of sumByRegion) {
    const cap = regionalCaps[region];
    if (cap !== null && cap !== undefined && sum > cap) {
      return `地域${region + 1}の目標定員合計（${sum}）が地域上限（${cap}）を超えています。`;
    }
  }
  return undefined;
}

/** 社員×社員のペア（field_type "employee_pair_list"）。値は 0-indexed の社員番号。 */
export type EmployeePair = readonly [number, number];

export interface EmployeePairDraftResult {
  pair?: EmployeePair;
  error?: string;
}

/**
 * field_type "employee_pair_list"（NG ペア等）の1件追加ドラフトを検証する。
 * 未選択・同一人物・追加済みの組み合わせを弾く（並び順に依存しない重複判定のため、
 * 返す pair は常に [小さい方, 大きい方] へ正規化する）。
 */
export function validateEmployeePairDraft(
  existingPairs: readonly EmployeePair[],
  firstIndex: number | null,
  secondIndex: number | null,
): EmployeePairDraftResult {
  if (firstIndex === null || secondIndex === null) {
    return { error: "2名とも選択してください。" };
  }
  if (firstIndex === secondIndex) {
    return { error: "同じ社員は選択できません。" };
  }
  const pair: EmployeePair =
    firstIndex < secondIndex ? [firstIndex, secondIndex] : [secondIndex, firstIndex];
  const isDuplicate = existingPairs.some(([a, b]) => a === pair[0] && b === pair[1]);
  if (isDuplicate) {
    return { error: "すでに追加済みの組み合わせです。" };
  }
  return { pair };
}
