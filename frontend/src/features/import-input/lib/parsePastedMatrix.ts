import { parsePastedRankTable, rankCellsToPrefs } from "../../../shared/lib";

/** 貼り付けで取り込む選好行列の種類。 */
export type PasteTarget = "employee_prefs" | "department_prefs";

export interface ParsePastedMatrixOptions {
  /** 行の呼称（例: "社員"）。 */
  rowLabel: string;
  /** 列の呼称（例: "部署"）。 */
  columnLabel: string;
  /** 現在の設定の行の名前一覧（行数の正本）。 */
  expectedRowNames: readonly string[];
  /** 現在の設定の列の名前一覧（列数の正本）。 */
  expectedColumnNames: readonly string[];
}

/** 行単位のエラー（該当行をインライン表示するための情報）。 */
export interface PastedRowError {
  rowIndex: number;
  rowName: string;
  message: string;
}

export interface PastedMatrixPreview {
  /** 見出し・名前列を除いた行数。 */
  rowCount: number;
  /** 見出し・名前列を除いた列数（行ごとに異なる場合は最大値）。 */
  columnCount: number;
  /** 表全体に関わるエラー（行数・列数・名前の不一致など）。 */
  tableErrors: string[];
  /** 行ごとのエラー（順位の重複・抜け・列数の不一致など）。 */
  rowErrors: PastedRowError[];
  /** エラーが無い場合のみ、選好リスト（1-indexed）。 */
  prefs: number[][] | null;
}

function checkNames(
  errors: string[],
  label: string,
  expected: readonly string[],
  actual: readonly string[] | null,
): void {
  // 件数の不一致は呼び出し側で別のエラーとして扱うため、ここでは件数が同じ場合のみ比べる。
  if (actual === null || actual.length !== expected.length) {
    return;
  }
  const mismatch = actual.findIndex((name, index) => name !== expected[index]);
  if (mismatch === -1) {
    return;
  }
  errors.push(
    `${mismatch + 1}番目の${label}名が現在の設定と一致しません（現在: "${expected[mismatch] ?? ""}"、貼り付け: "${actual[mismatch] ?? ""}"）。`,
  );
}

/**
 * Excel 等からコピーした選好行列（行 = 順位をつける人、列 = 相手、セル = 希望順位）の
 * 貼り付けを、選好入力画面の現在の設定（社員・部署の人数と名前）に照らして検証する。
 *
 * 見出し行・名前列は任意（あれば現在の設定の名前と並び順まで一致することを要求する）。
 * CSV ファイルの取込と違い、貼り付けは順位の誤り（重複・抜け・不正な値・未入力の行）も
 * 反映をブロックするエラーとし、該当行を特定して返す。
 */
export function parsePastedMatrix(
  text: string,
  options: ParsePastedMatrixOptions,
): PastedMatrixPreview {
  const { rowLabel, columnLabel, expectedRowNames, expectedColumnNames } = options;
  const table = parsePastedRankTable(text);
  const rowCount = table.rows.length;
  const columnCount = Math.max(0, ...table.rows.map((row) => row.length));
  const tableErrors: string[] = [];
  const rowErrors: PastedRowError[] = [];

  if (rowCount === 0) {
    return {
      rowCount,
      columnCount,
      tableErrors: ["貼り付けた内容に行がありません。"],
      rowErrors,
      prefs: null,
    };
  }

  if (rowCount !== expectedRowNames.length) {
    tableErrors.push(
      `${rowLabel}数が一致しません（現在: ${expectedRowNames.length}件、貼り付け: ${rowCount}行）。`,
    );
  }
  if (table.columnNames !== null && table.columnNames.length !== expectedColumnNames.length) {
    tableErrors.push(
      `見出しの${columnLabel}数が一致しません（現在: ${expectedColumnNames.length}件、貼り付け: ${table.columnNames.length}列）。`,
    );
  }
  checkNames(tableErrors, columnLabel, expectedColumnNames, table.columnNames);
  if (rowCount === expectedRowNames.length) {
    checkNames(tableErrors, rowLabel, expectedRowNames, table.rowNames);
  }

  table.rows.forEach((cells, rowIndex) => {
    const rowName = expectedRowNames[rowIndex] ?? table.rowNames?.[rowIndex] ?? `${rowIndex + 1}行目`;
    if (cells.length !== expectedColumnNames.length) {
      rowErrors.push({
        rowIndex,
        rowName,
        message: `列数が一致しません（${columnLabel}${expectedColumnNames.length}件に対して${cells.length}列）。`,
      });
      return;
    }
    const result = rankCellsToPrefs(cells);
    if ("error" in result) {
      rowErrors.push({ rowIndex, rowName, message: result.error });
    }
  });

  const prefs =
    tableErrors.length === 0 && rowErrors.length === 0
      ? table.rows.map((cells) => {
          const result = rankCellsToPrefs(cells);
          return "prefs" in result ? result.prefs : [];
        })
      : null;

  return { rowCount, columnCount, tableErrors, rowErrors, prefs };
}
