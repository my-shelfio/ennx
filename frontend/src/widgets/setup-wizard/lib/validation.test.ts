import { expect, test } from "vitest";

import {
  DEPARTMENT_COUNT_MAX,
  EMPLOYEE_COUNT_MAX,
  isCapacitySumBelowEmployeeCount,
  sumCapacities,
  validateCapacities,
  validateEmployeePairDraft,
  validateMaxCaps,
  validateRegionalCapacitySums,
  validateRegionalCaps,
  validateRegions,
  validateScaleStep,
} from "./validation";

test("有効な規模の入力ではエラーが発生しない", () => {
  expect(validateScaleStep(3, 10)).toEqual({});
});

test("未入力（null）はエラーになる", () => {
  const errors = validateScaleStep(null, null);
  expect(errors.departmentCount).toBe("部署数を入力してください。");
  expect(errors.employeeCount).toBe("社員数を入力してください。");
});

test("整数以外はエラーになる", () => {
  const errors = validateScaleStep(1.5, 3);
  expect(errors.departmentCount).toBe("部署数は整数で入力してください。");
});

test("0以下はエラーになる", () => {
  const errors = validateScaleStep(0, 3);
  expect(errors.departmentCount).toBe("部署数は1以上で入力してください。");
});

test("上限超過はエラーになる", () => {
  const errors = validateScaleStep(DEPARTMENT_COUNT_MAX + 1, EMPLOYEE_COUNT_MAX + 1);
  expect(errors.departmentCount).toBe(`部署数は${DEPARTMENT_COUNT_MAX}以下で入力してください。`);
  expect(errors.employeeCount).toBe(`社員数は${EMPLOYEE_COUNT_MAX}以下で入力してください。`);
});

test("validateCapacities: 未入力・負数・小数はエラーになる", () => {
  const errors = validateCapacities([3, null, -1, 1.5]);
  expect(errors[0]).toBeUndefined();
  expect(errors[1]).toBe("定員を入力してください。");
  expect(errors[2]).toBe("0以上の整数で入力してください。");
  expect(errors[3]).toBe("0以上の整数で入力してください。");
});

test("sumCapacities: null は0として扱い合計する", () => {
  expect(sumCapacities([3, 2, null])).toBe(5);
  expect(sumCapacities([])).toBe(0);
  expect(sumCapacities([null, null])).toBe(0);
});

test("isCapacitySumBelowEmployeeCount: 定員合計が社員数未満なら true", () => {
  expect(isCapacitySumBelowEmployeeCount([2, 2], 5)).toBe(true);
  expect(isCapacitySumBelowEmployeeCount([3, 2], 5)).toBe(false);
  expect(isCapacitySumBelowEmployeeCount([3, null], 5)).toBe(true);
});

test("validateMaxCaps: 設置上限が目標定員未満だとエラーになる", () => {
  const errors = validateMaxCaps([3, 2], [2, 5]);
  expect(errors[0]).toBe("設置上限は目標定員以上で入力してください。");
  expect(errors[1]).toBeUndefined();
});

test("validateRegions: 範囲外の地域番号はエラーになる", () => {
  const errors = validateRegions([0, 2], 2);
  expect(errors[0]).toBeUndefined();
  expect(errors[1]).toBe("地域は一覧から選択してください。");
});

test("validateRegionalCaps: 未入力・負数はエラーになる", () => {
  const errors = validateRegionalCaps([5, null, -1]);
  expect(errors[0]).toBeUndefined();
  expect(errors[1]).toBe("地域上限を入力してください。");
  expect(errors[2]).toBe("0以上の整数で入力してください。");
});

test("validateRegionalCapacitySums: 地域内の目標定員合計が地域上限を超えるとエラーメッセージを返す", () => {
  // 地域0（部署0,1）の目標定員合計 = 3 + 3 = 6 > 地域上限 5
  const error = validateRegionalCapacitySums([3, 3], [0, 0], [5]);
  expect(error).toBe("地域1の目標定員合計（6）が地域上限（5）を超えています。");
});

test("validateRegionalCapacitySums: 合計が上限以下なら undefined", () => {
  const error = validateRegionalCapacitySums([2, 3], [0, 0], [5]);
  expect(error).toBeUndefined();
});

test("validateEmployeePairDraft: 未選択はエラー", () => {
  const result = validateEmployeePairDraft([], null, 1);
  expect(result.error).toBe("2名とも選択してください。");
});

test("validateEmployeePairDraft: 同一人物はエラー", () => {
  const result = validateEmployeePairDraft([], 2, 2);
  expect(result.error).toBe("同じ社員は選択できません。");
});

test("validateEmployeePairDraft: 有効な組み合わせは [小さい方, 大きい方] へ正規化して返す", () => {
  const result = validateEmployeePairDraft([], 3, 1);
  expect(result.pair).toEqual([1, 3]);
  expect(result.error).toBeUndefined();
});

test("validateEmployeePairDraft: 並び順が逆でも追加済みなら重複エラー", () => {
  const result = validateEmployeePairDraft([[1, 3]], 3, 1);
  expect(result.error).toBe("すでに追加済みの組み合わせです。");
});
