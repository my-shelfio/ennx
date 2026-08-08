import type { RankCell, RankMatrix } from "../../../entities/matching";
import { prefsFromMatrix, validateRow } from "../../../entities/matching";

import type { ImportIssue } from "./types";

export interface ParseMatrixCsvOptions {
  /** 行の呼称（例: "社員"）。エラーメッセージに使う。 */
  rowLabel: string;
  /** 列の呼称（例: "部署"）。エラーメッセージに使う。 */
  columnLabel: string;
  rowMax: number;
  columnMax: number;
}

export interface ParsedMatrixCsv {
  /** 行見出し（例: 社員名一覧）。 */
  rowNames: string[];
  /** 列見出し（例: 部署名一覧）。 */
  columnNames: string[];
  matrix: RankMatrix;
  /** `matrix` を選好リスト（1-indexed）へ変換したもの。 */
  prefs: number[][];
  issues: ImportIssue[];
}

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (value === "") {
      continue;
    }
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates];
}

/**
 * employee_prefs.csv / department_prefs.csv（1行目=ヘッダー：先頭セルは無視し以降が列名、
 * 以降の行=先頭セルが行名、以降が順位）をパース・検証する。
 *
 * 行・列の見出しの空欄・重複・上限超過は取込をブロックする。
 * セルの順位エラー（重複・範囲外・空欄行）は entities/matching の validateRow
 * （widgets/preference-matrix の行列エディタと同一のロジック）で検出し、
 * `blocking: false` として扱う（#123: エラーがあっても取り込み、行列UI上で修正できるようにする）。
 * 不正な値（整数でない・1未満）のセルは null（未入力）として扱い、行列自体は生成する。
 */
export function parseMatrixCsv(
  fileName: string,
  grid: readonly string[][],
  options: ParseMatrixCsvOptions,
): ParsedMatrixCsv {
  const issues: ImportIssue[] = [];

  if (grid.length === 0) {
    issues.push({ blocking: true, message: `${fileName}: ヘッダー行がありません。` });
    return { rowNames: [], columnNames: [], matrix: [], prefs: [], issues };
  }

  const [header, ...dataRows] = grid as [string[], ...string[][]];
  const columnNames = header.slice(1).map((cell) => cell.trim());

  columnNames.forEach((name, columnIndex) => {
    if (name === "") {
      issues.push({
        blocking: true,
        message: `${fileName} のヘッダー行: ${columnIndex + 2}列目の${options.columnLabel}名が空欄です。`,
      });
    }
  });
  const columnDuplicates = findDuplicates(columnNames);
  if (columnDuplicates.length > 0) {
    issues.push({
      blocking: true,
      message: `${fileName}: ${options.columnLabel}名が重複しています（${columnDuplicates.join("、")}）。`,
    });
  }
  if (columnNames.length > options.columnMax) {
    issues.push({
      blocking: true,
      message: `${fileName}: ${options.columnLabel}数が上限（${options.columnMax}）を超えています（${columnNames.length}件）。`,
    });
  }

  if (dataRows.length === 0) {
    issues.push({ blocking: true, message: `${fileName}: データ行がありません。` });
  }
  if (dataRows.length > options.rowMax) {
    issues.push({
      blocking: true,
      message: `${fileName}: ${options.rowLabel}数が上限（${options.rowMax}）を超えています（${dataRows.length}件）。`,
    });
  }

  const rowNames = dataRows.map((row) => (row[0] ?? "").trim());
  rowNames.forEach((name, rowIndex) => {
    if (name === "") {
      issues.push({
        blocking: true,
        message: `${fileName} の${rowIndex + 2}行目: ${options.rowLabel}名が空欄です。`,
      });
    }
  });
  const rowDuplicates = findDuplicates(rowNames);
  if (rowDuplicates.length > 0) {
    issues.push({
      blocking: true,
      message: `${fileName}: ${options.rowLabel}名が重複しています（${rowDuplicates.join("、")}）。`,
    });
  }

  const matrix: RankCell[][] = dataRows.map((row, rowIndex) => {
    const rowName = rowNames[rowIndex] || `${rowIndex + 2}行目`;
    return columnNames.map((columnName, columnIndex) => {
      const raw = (row[columnIndex + 1] ?? "").trim();
      if (raw === "") {
        return null;
      }
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 1) {
        const columnLabel = columnName || `${columnIndex + 2}列目`;
        issues.push({
          blocking: false,
          message: `${fileName} の「${rowName}」×「${columnLabel}」: 順位は1以上の整数で入力してください（現在の値: "${raw}"）。`,
        });
        return null;
      }
      return value;
    });
  });

  matrix.forEach((row, rowIndex) => {
    const rowName = rowNames[rowIndex] || `${rowIndex + 2}行目`;
    const validation = validateRow(row);
    if (validation.duplicateColumns.size > 0) {
      const duplicateColumnLabels = [...validation.duplicateColumns]
        .sort((a, b) => a - b)
        .map((columnIndex) => columnNames[columnIndex] || `${columnIndex + 2}列目`);
      issues.push({
        blocking: false,
        message: `${fileName} の「${rowName}」行: 順位が重複しています（${duplicateColumnLabels.join("、")}）。`,
      });
    } else if (validation.continuityError !== undefined) {
      issues.push({
        blocking: false,
        message: `${fileName} の「${rowName}」行: ${validation.continuityError}`,
      });
    }
  });

  return {
    rowNames,
    columnNames,
    matrix,
    prefs: prefsFromMatrix(matrix),
    issues,
  };
}

