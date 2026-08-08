import { describe, expect, it } from "vitest";

import { toCsvRow } from "../../../shared/lib";

import { parseImportFiles } from "./parseImportFiles";
import type { RawImportFile } from "./types";

function file(fileName: string, rows: readonly (readonly string[])[]): RawImportFile {
  return { fileName, text: rows.map((row) => toCsvRow(row)).join("\r\n") };
}

const settingsCsv = file("settings.csv", [
  ["部署名", "定員"],
  ["営業", "1"],
  ["企画", "1"],
]);

const employeePrefsCsv = file("employee_prefs.csv", [
  ["", "営業", "企画"],
  ["田中", "1", "2"],
  ["佐藤", "2", "1"],
]);

const departmentPrefsCsv = file("department_prefs.csv", [
  ["", "田中", "佐藤"],
  ["営業", "1", "2"],
  ["企画", "2", "1"],
]);

describe("parseImportFiles", () => {
  it("3ファイルとも正しい場合、canConfirmがtrueになり全フィールドを取得できる", () => {
    const result = parseImportFiles([settingsCsv, employeePrefsCsv, departmentPrefsCsv], {
      requiredRoles: ["settings", "employee_prefs", "department_prefs"],
    });

    expect(result.canConfirm).toBe(true);
    expect(result.issues.some((issue) => issue.blocking)).toBe(false);
    expect(result.departmentNames).toEqual(["営業", "企画"]);
    expect(result.employeeNames).toEqual(["田中", "佐藤"]);
    expect(result.capacities).toEqual([1, 1]);
    expect(result.proposerPrefs).toEqual([
      [1, 2],
      [2, 1],
    ]);
    expect(result.receiverPrefs).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it("必須ファイルが不足している場合はブロッキングissueとなりcanConfirmがfalseになる", () => {
    const result = parseImportFiles([settingsCsv, employeePrefsCsv], {
      requiredRoles: ["settings", "employee_prefs", "department_prefs"],
    });

    expect(result.canConfirm).toBe(false);
    expect(
      result.issues.some(
        (issue) => issue.blocking && issue.message.includes("department_prefs.csv"),
      ),
    ).toBe(true);
  });

  it("認識できないファイル名は無視され、非ブロッキングissueになる", () => {
    const unrecognized = file("random.csv", [["a", "b"]]);
    const result = parseImportFiles([settingsCsv, employeePrefsCsv, departmentPrefsCsv, unrecognized], {
      requiredRoles: ["settings", "employee_prefs", "department_prefs"],
    });

    expect(result.unrecognizedFileNames).toEqual(["random.csv"]);
    expect(
      result.issues.some((issue) => !issue.blocking && issue.message.includes("random.csv")),
    ).toBe(true);
    // 認識できないファイルがあっても、他3ファイルが揃っていれば取込は可能。
    expect(result.canConfirm).toBe(true);
  });

  it("ファイル間で部署名・社員名が一致しない場合はブロッキングissueになる", () => {
    const mismatchedEmployeePrefs = file("employee_prefs.csv", [
      ["", "営業", "広報"],
      ["田中", "1", "2"],
      ["佐藤", "2", "1"],
    ]);
    const result = parseImportFiles([settingsCsv, mismatchedEmployeePrefs, departmentPrefsCsv], {
      requiredRoles: ["settings", "employee_prefs", "department_prefs"],
    });

    expect(result.canConfirm).toBe(false);
    expect(
      result.issues.some((issue) => issue.blocking && issue.message.includes("部署")),
    ).toBe(true);
  });

  it("順位の重複・範囲外・空欄は行・列を特定した非ブロッキングissueとなり、取込自体はブロックしない", () => {
    const invalidRankPrefs = file("employee_prefs.csv", [
      ["", "営業", "企画"],
      ["田中", "1", "1"], // 重複
      ["佐藤", "0", ""], // 範囲外・空欄
    ]);
    const result = parseImportFiles([settingsCsv, invalidRankPrefs, departmentPrefsCsv], {
      requiredRoles: ["settings", "employee_prefs", "department_prefs"],
    });

    const nonBlocking = result.issues.filter((issue) => !issue.blocking);
    expect(nonBlocking.some((issue) => issue.message.includes("田中"))).toBe(true);
    expect(nonBlocking.some((issue) => issue.message.includes("佐藤"))).toBe(true);
    // 順位エラーはブロッキングではないため、他に問題が無ければ取込は可能。
    expect(result.issues.some((issue) => issue.blocking)).toBe(false);
    expect(result.canConfirm).toBe(true);
  });

  it("部署数・社員数が上限を超える場合はブロッキングissueになる", () => {
    const header = ["", ...Array.from({ length: 51 }, (_, i) => `部署${i + 1}`)];
    const row = ["社員1", ...Array.from({ length: 51 }, () => "")];
    const tooManyDepartments = file("employee_prefs.csv", [header, row]);
    const result = parseImportFiles([tooManyDepartments], {
      requiredRoles: ["employee_prefs"],
    });

    expect(result.canConfirm).toBe(false);
    expect(result.issues.some((issue) => issue.blocking && issue.message.includes("上限"))).toBe(
      true,
    );
  });

  it("再取込（preferencesモード）で現在の部署名・社員名と一致すれば取り込める", () => {
    const result = parseImportFiles([employeePrefsCsv, departmentPrefsCsv], {
      requiredRoles: ["employee_prefs", "department_prefs"],
      expectedDepartmentNames: ["営業", "企画"],
      expectedEmployeeNames: ["田中", "佐藤"],
    });

    expect(result.canConfirm).toBe(true);
  });

  it("再取込（preferencesモード）で現在の設定と名前が一致しない場合はブロッキングissueになる", () => {
    const result = parseImportFiles([employeePrefsCsv, departmentPrefsCsv], {
      requiredRoles: ["employee_prefs", "department_prefs"],
      expectedDepartmentNames: ["営業", "広報"],
      expectedEmployeeNames: ["田中", "佐藤"],
    });

    expect(result.canConfirm).toBe(false);
    expect(
      result.issues.some((issue) => issue.blocking && issue.message.includes("現在の設定")),
    ).toBe(true);
  });
});
