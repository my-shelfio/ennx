import type { EmployeeAssignmentRow, MatchingResult } from "../../../entities/matching";
import { buildEmployeeAssignmentRows } from "../../../entities/matching";
import { toCsvRow } from "../../../shared/lib";

/**
 * エクスポート（CSV）向けの社員別配属表の算出。
 *
 * 社員の配属先・希望順位の算出は widgets/assignment-map（配属マップ・詳細テーブル）
 * と同一のロジックが必要なため、entities/matching/lib/assignment
 * （buildEmployeeAssignmentRows）を共有する（features 層は widgets 層に依存できない、
 * FSD 層依存規則。entities 層は双方の下位層のため両立できる）。
 *
 * CSVのエスケープ・行組み立ては features/import-input（テンプレートCSV・現在の入力の
 * CSVエクスポート）と共有するため shared/lib（csv.ts）に置く。
 */
const CSV_HEADER = ["社員名", "配属部署", "希望順位"];

/** 社員別配属表のCSV文字列を組み立てる（先頭にUTF-8 BOMは付与しない。呼び出し側で Blob 生成時に付与する）。 */
export function buildAssignmentCsv(
  result: MatchingResult,
  proposerPrefs: readonly (readonly number[])[],
): string {
  const rows = buildEmployeeAssignmentRows(result, proposerPrefs);
  const lines = [
    toCsvRow(CSV_HEADER),
    ...rows.map((row: EmployeeAssignmentRow) =>
      toCsvRow([
        row.employeeName,
        row.departmentName ?? "未配属",
        row.rank !== null ? String(row.rank) : "",
      ]),
    ),
  ];
  return lines.join("\r\n");
}
