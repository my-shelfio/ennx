import { parsePastedRankTable, rankCellsToPrefs } from "../../../shared/lib";

export interface ParsePastedAssignmentOptions {
  /** 社員数の上限（割り当ての入力上限）。 */
  employeeMax: number;
  /** 部署数の上限（割り当ての入力上限）。 */
  departmentMax: number;
}

/** 行単位のエラー（該当行をインライン表示するための情報）。 */
export interface PastedAssignmentRowError {
  rowIndex: number;
  /** 名前列があればその社員名、なければ空文字。 */
  rowName: string;
  message: string;
}

/** 貼り付けから読み取った割り当ての入力（規模は貼り付けに合わせる）。 */
export interface PastedAssignment {
  employeeCount: number;
  departmentCount: number;
  /** 見出し行があれば部署名、なければ null（現在の名前を保つ）。 */
  departmentNames: string[] | null;
  /** 名前列があれば社員名、なければ null（現在の名前を保つ）。 */
  employeeNames: string[] | null;
  /** 社員ごとの希望順位（1-indexed の部署番号を希望順に並べたもの）。 */
  agentPrefs: number[][];
}

export interface PastedAssignmentPreview {
  employeeCount: number;
  departmentCount: number;
  /** 表全体に関わるエラー（上限超過・名前の空欄や重複など）。 */
  tableErrors: string[];
  /** 行ごとのエラー（順位の重複・抜け・列数の不一致など）。 */
  rowErrors: PastedAssignmentRowError[];
  /** エラーが無い場合のみ、取り込む内容。 */
  pasted: PastedAssignment | null;
}

function findDuplicates(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const name of names) {
    if (name !== "" && seen.has(name)) {
      duplicates.add(name);
    }
    seen.add(name);
  }
  return [...duplicates];
}

function checkNames(errors: string[], label: string, names: readonly string[] | null): void {
  if (names === null) {
    return;
  }
  const blankIndex = names.findIndex((name) => name === "");
  if (blankIndex !== -1) {
    errors.push(`${blankIndex + 1}番目の${label}名が空欄です。`);
  }
  const duplicates = findDuplicates(names);
  if (duplicates.length > 0) {
    errors.push(`${label}名が重複しています（${duplicates.join("、")}）。`);
  }
}

/**
 * Excel 等からコピーした割り当ての希望順位（行 = 社員、列 = 部署、セル = 希望順位）の
 * 貼り付けを検証し、取り込む内容を組み立てる。
 *
 * 割り当ては 1 画面で規模も入力するため、社員数・部署数は貼り付けに合わせる
 * （部署数は見出し行があればその列数、なければ最も長い行の列数）。
 * 見出し行・名前列は任意で、あれば部署名・社員名として取り込む。
 * 順位の誤り（重複・抜け・不正な値・未入力の行）と列数の不一致は、該当行のエラーとして
 * 反映をブロックする（希望しない部署は空欄にする）。
 */
export function parsePastedAssignment(
  text: string,
  options: ParsePastedAssignmentOptions,
): PastedAssignmentPreview {
  const table = parsePastedRankTable(text);
  const employeeCount = table.rows.length;
  const departmentCount =
    table.columnNames?.length ?? Math.max(0, ...table.rows.map((row) => row.length));
  const tableErrors: string[] = [];
  const rowErrors: PastedAssignmentRowError[] = [];

  if (employeeCount === 0) {
    return {
      employeeCount,
      departmentCount,
      tableErrors: ["貼り付けた内容に行がありません。"],
      rowErrors,
      pasted: null,
    };
  }
  if (employeeCount > options.employeeMax) {
    tableErrors.push(`社員数が上限（${options.employeeMax}人）を超えています（${employeeCount}行）。`);
  }
  if (departmentCount > options.departmentMax) {
    tableErrors.push(
      `部署数が上限（${options.departmentMax}件）を超えています（${departmentCount}列）。`,
    );
  }
  checkNames(tableErrors, "部署", table.columnNames);
  checkNames(tableErrors, "社員", table.rowNames);

  const agentPrefs: number[][] = [];
  table.rows.forEach((cells, rowIndex) => {
    const rowName = table.rowNames?.[rowIndex] ?? "";
    if (cells.length !== departmentCount) {
      rowErrors.push({
        rowIndex,
        rowName,
        message: `列数が一致しません（部署${departmentCount}件に対して${cells.length}列）。`,
      });
      return;
    }
    const result = rankCellsToPrefs(cells);
    if ("error" in result) {
      rowErrors.push({ rowIndex, rowName, message: result.error });
      return;
    }
    agentPrefs.push(result.prefs);
  });

  const hasError = tableErrors.length > 0 || rowErrors.length > 0;
  return {
    employeeCount,
    departmentCount,
    tableErrors,
    rowErrors,
    pasted: hasError
      ? null
      : {
          employeeCount,
          departmentCount,
          departmentNames: table.columnNames,
          employeeNames: table.rowNames,
          agentPrefs,
        },
  };
}

/**
 * 貼り付けで社員の並び（名前）が現在と変わるかどうか。
 * 追加の制約（同じ部署に配属しない組）は社員の並び順（index）で社員を指すため、
 * 並びが変わる場合は制約を解除する必要がある。名前列が無い貼り付けは並びを判断できないため、
 * 現在の並びのままとみなす（社員数が変わる場合の解除は規模変更の規則が担う）。
 */
export function employeeNamesChanged(
  pasted: PastedAssignment,
  currentEmployeeNames: readonly string[],
): boolean {
  if (pasted.employeeNames === null) {
    return false;
  }
  return (
    pasted.employeeNames.length !== currentEmployeeNames.length ||
    pasted.employeeNames.some((name, index) => name !== currentEmployeeNames[index])
  );
}
