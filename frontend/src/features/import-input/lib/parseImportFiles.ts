import { DEPARTMENT_COUNT_MAX, EMPLOYEE_COUNT_MAX } from "../../../entities/matching";
import { parseCsv } from "../../../shared/lib";

import { parseMatrixCsv } from "./parseMatrixCsv";
import { parseSettingsCsv } from "./parseSettingsCsv";
import { IMPORT_FILE_NAMES } from "./types";
import type { ImportFileRole, ImportIssue, ImportPreview, RawImportFile } from "./types";

export interface ParseImportFilesOptions {
  /** この取込フローで必須のファイル役割（不足時は取込をブロックする）。 */
  requiredRoles: readonly ImportFileRole[];
  /**
   * 選好行列のみの再取込（pages/preferences）向け: 現在の部署名一覧との整合を検証する。
   * 未指定の場合は検証しない（設定ウィザードからの新規取込向け）。
   */
  expectedDepartmentNames?: readonly string[];
  /** 選好行列のみの再取込向け: 現在の社員名一覧との整合を検証する。 */
  expectedEmployeeNames?: readonly string[];
}

function resolveRole(fileName: string): ImportFileRole | undefined {
  const lower = fileName.trim().toLowerCase();
  return (Object.keys(IMPORT_FILE_NAMES) as ImportFileRole[]).find(
    (role) => IMPORT_FILE_NAMES[role] === lower,
  );
}

/** 2つの名前一覧が完全一致（件数・並び順とも）するかどうかを検証し、不一致なら issue を追加する。 */
function checkNameListsMatch(
  issues: ImportIssue[],
  labelA: string,
  namesA: readonly string[],
  labelB: string,
  namesB: readonly string[],
  kind: string,
): void {
  if (namesA.length !== namesB.length) {
    issues.push({
      blocking: true,
      message: `${labelA}と${labelB}で${kind}数が一致しません（${labelA}: ${namesA.length}件、${labelB}: ${namesB.length}件）。`,
    });
    return;
  }
  for (let index = 0; index < namesA.length; index += 1) {
    if (namesA[index] !== namesB[index]) {
      issues.push({
        blocking: true,
        message: `${labelA}と${labelB}で${index + 1}番目の${kind}名が一致しません（${labelA}: "${namesA[index]}"、${labelB}: "${namesB[index]}"）。同じ並び順・同じ名前で入力してください。`,
      });
      return;
    }
  }
}

/**
 * 選択された CSV ファイル一式（settings.csv / employee_prefs.csv / department_prefs.csv の
 * うち提供されたもの）をパース・相互検証し、取込プレビューを組み立てる。
 *
 * ファイル名で役割を判定し（大文字小文字は区別しない）、部署名・社員名は
 * ファイル間で完全一致（件数・並び順とも）することを要求する（不一致は取込をブロックする）。
 * 順位の重複・範囲外・空欄行は取込をブロックしない（#123: 取り込んだ上で行列UIから修正できる）。
 */
export function parseImportFiles(
  files: readonly RawImportFile[],
  options: ParseImportFilesOptions,
): ImportPreview {
  const issues: ImportIssue[] = [];
  const byRole = new Map<ImportFileRole, RawImportFile>();
  const unrecognizedFileNames: string[] = [];

  for (const file of files) {
    const role = resolveRole(file.fileName);
    if (role === undefined) {
      unrecognizedFileNames.push(file.fileName);
      continue;
    }
    if (byRole.has(role)) {
      issues.push({
        blocking: true,
        message: `${IMPORT_FILE_NAMES[role]} が複数選択されています。1つだけ選択してください。`,
      });
      continue;
    }
    byRole.set(role, file);
  }

  unrecognizedFileNames.forEach((name) => {
    issues.push({
      blocking: false,
      message: `ファイル「${name}」は認識できませんでした（settings.csv / employee_prefs.csv / department_prefs.csv のいずれかのファイル名を選択してください）。このファイルは無視されました。`,
    });
  });

  options.requiredRoles.forEach((role) => {
    if (!byRole.has(role)) {
      issues.push({
        blocking: true,
        message: `必要なファイルが選択されていません: ${IMPORT_FILE_NAMES[role]}`,
      });
    }
  });

  let departmentNamesFromSettings: string[] | null = null;
  let capacities: number[] | null = null;
  const settingsFile = byRole.get("settings");
  if (settingsFile !== undefined) {
    const parsed = parseSettingsCsv(IMPORT_FILE_NAMES.settings, parseCsv(settingsFile.text));
    issues.push(...parsed.issues);
    departmentNamesFromSettings = parsed.departmentNames;
    capacities = parsed.capacities;
  }

  let employeePrefsRowNames: string[] | null = null;
  let employeePrefsColumnNames: string[] | null = null;
  let proposerPrefs: number[][] | null = null;
  const employeeFile = byRole.get("employee_prefs");
  if (employeeFile !== undefined) {
    const parsed = parseMatrixCsv(IMPORT_FILE_NAMES.employee_prefs, parseCsv(employeeFile.text), {
      rowLabel: "社員",
      columnLabel: "部署",
      rowMax: EMPLOYEE_COUNT_MAX,
      columnMax: DEPARTMENT_COUNT_MAX,
    });
    issues.push(...parsed.issues);
    employeePrefsRowNames = parsed.rowNames;
    employeePrefsColumnNames = parsed.columnNames;
    proposerPrefs = parsed.prefs;
  }

  let departmentPrefsRowNames: string[] | null = null;
  let departmentPrefsColumnNames: string[] | null = null;
  let receiverPrefs: number[][] | null = null;
  const departmentFile = byRole.get("department_prefs");
  if (departmentFile !== undefined) {
    const parsed = parseMatrixCsv(
      IMPORT_FILE_NAMES.department_prefs,
      parseCsv(departmentFile.text),
      {
        rowLabel: "部署",
        columnLabel: "社員",
        rowMax: DEPARTMENT_COUNT_MAX,
        columnMax: EMPLOYEE_COUNT_MAX,
      },
    );
    issues.push(...parsed.issues);
    departmentPrefsRowNames = parsed.rowNames;
    departmentPrefsColumnNames = parsed.columnNames;
    receiverPrefs = parsed.prefs;
  }

  // 部署名の正本: settings.csv > employee_prefs.csv の列見出し > department_prefs.csv の行見出し。
  const departmentNames = departmentNamesFromSettings ?? employeePrefsColumnNames ?? departmentPrefsRowNames;
  // 社員名の正本: employee_prefs.csv の行見出し > department_prefs.csv の列見出し。
  const employeeNames = employeePrefsRowNames ?? departmentPrefsColumnNames;

  if (settingsFile !== undefined && employeePrefsColumnNames !== null) {
    checkNameListsMatch(
      issues,
      "settings.csv",
      departmentNamesFromSettings ?? [],
      "employee_prefs.csv（列見出し）",
      employeePrefsColumnNames,
      "部署",
    );
  }
  if (departmentPrefsRowNames !== null && departmentNames !== null && (settingsFile !== undefined || employeeFile !== undefined)) {
    checkNameListsMatch(
      issues,
      settingsFile !== undefined ? "settings.csv" : "employee_prefs.csv（列見出し）",
      departmentNames,
      "department_prefs.csv（行見出し）",
      departmentPrefsRowNames,
      "部署",
    );
  }
  if (employeeFile !== undefined && departmentPrefsColumnNames !== null) {
    checkNameListsMatch(
      issues,
      "employee_prefs.csv（行見出し）",
      employeePrefsRowNames ?? [],
      "department_prefs.csv（列見出し）",
      departmentPrefsColumnNames,
      "社員",
    );
  }

  if (options.expectedDepartmentNames !== undefined && departmentNames !== null) {
    checkNameListsMatch(
      issues,
      "現在の設定",
      options.expectedDepartmentNames,
      "取込データ",
      departmentNames,
      "部署",
    );
  }
  if (options.expectedEmployeeNames !== undefined && employeeNames !== null) {
    checkNameListsMatch(
      issues,
      "現在の設定",
      options.expectedEmployeeNames,
      "取込データ",
      employeeNames,
      "社員",
    );
  }

  const hasBlockingIssue = issues.some((issue) => issue.blocking);
  const hasAllRequiredRoles = options.requiredRoles.every((role) => byRole.has(role));

  return {
    recognizedRoles: [...byRole.keys()],
    unrecognizedFileNames,
    departmentNames,
    employeeNames,
    capacities,
    proposerPrefs,
    receiverPrefs,
    issues,
    canConfirm: !hasBlockingIssue && hasAllRequiredRoles,
  };
}
