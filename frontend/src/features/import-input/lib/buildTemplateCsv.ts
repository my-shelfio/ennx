import type { RankMatrix } from "../../../entities/matching";
import { toCsvRow, UTF8_BOM } from "../../../shared/lib";

/**
 * settings.csv 形式の文字列を組み立てる（先頭に UTF-8 BOM を付与、Excel互換のCRLF改行）。
 * テンプレート配布（サンプル行入り）・現在の入力のCSVエクスポートの双方から使う。
 */
export function buildSettingsCsv(
  departmentNames: readonly string[],
  capacities: readonly number[],
): string {
  const lines = [
    toCsvRow(["部署名", "定員"]),
    ...departmentNames.map((name, index) => toCsvRow([name, String(capacities[index] ?? 0)])),
  ];
  return UTF8_BOM + lines.join("\r\n");
}

/**
 * employee_prefs.csv / department_prefs.csv 形式の文字列を組み立てる
 * （1行目=コーナーラベル+列見出し、以降=行見出し+順位）。
 */
export function buildMatrixCsv(
  cornerLabel: string,
  rowNames: readonly string[],
  columnNames: readonly string[],
  matrix: RankMatrix,
): string {
  const lines = [
    toCsvRow([cornerLabel, ...columnNames]),
    ...rowNames.map((name, rowIndex) =>
      toCsvRow([
        name,
        ...(matrix[rowIndex] ?? []).map((cell) => (cell === null ? "" : String(cell))),
      ]),
    ),
  ];
  return UTF8_BOM + lines.join("\r\n");
}

/**
 * テンプレートの記入例（サンプル行）。3ファイルとも部署名・社員名の並び順を一致させ、
 * そのまま取り込んでも成立する（cross-file の名前整合チェックを満たす）値にしておく。
 */
const SAMPLE_DEPARTMENT_NAMES = ["営業部", "開発部", "管理部"];
const SAMPLE_CAPACITIES = [10, 8, 5];
const SAMPLE_EMPLOYEE_NAMES = ["山田太郎", "鈴木花子"];
/** 行=社員（SAMPLE_EMPLOYEE_NAMES順）、列=部署（SAMPLE_DEPARTMENT_NAMES順）。 */
const SAMPLE_PROPOSER_MATRIX: RankMatrix = [
  [1, 2, 3],
  [2, 1, 3],
];
/** 行=部署（SAMPLE_DEPARTMENT_NAMES順）、列=社員（SAMPLE_EMPLOYEE_NAMES順）。 */
const SAMPLE_RECEIVER_MATRIX: RankMatrix = [
  [2, 1],
  [1, 2],
  [1, 2],
];

export function buildTemplateSettingsCsv(): string {
  return buildSettingsCsv(SAMPLE_DEPARTMENT_NAMES, SAMPLE_CAPACITIES);
}

export function buildTemplateEmployeePrefsCsv(): string {
  return buildMatrixCsv(
    "社員＼部署",
    SAMPLE_EMPLOYEE_NAMES,
    SAMPLE_DEPARTMENT_NAMES,
    SAMPLE_PROPOSER_MATRIX,
  );
}

export function buildTemplateDepartmentPrefsCsv(): string {
  return buildMatrixCsv(
    "部署＼社員",
    SAMPLE_DEPARTMENT_NAMES,
    SAMPLE_EMPLOYEE_NAMES,
    SAMPLE_RECEIVER_MATRIX,
  );
}
