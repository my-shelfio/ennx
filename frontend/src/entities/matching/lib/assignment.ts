import type { MatchingResult } from "../model/types";

/**
 * 配属結果のビューモデル算出。
 * `MatchingResult`（0-indexed の配属結果）と選好リスト（1-indexed）から、
 * 表示用のデータ構造を組み立てる純粋関数群。
 *
 * widgets/assignment-map（配属マップ・詳細テーブル）と features/export-result
 * （CSVエクスポート）の双方が同じ算出（社員の配属先・希望順位）を必要とするため、
 * entities 層に配置する（FSD 層依存規則上、features は widgets に
 * 依存できず、widgets 側に置くと features から再利用できないため）。
 */

/**
 * ReportItem.blocking_pairs（OpenAPI 生成型では number[][]、実際の要素長は常に2）を
 * 型安全な [社員 0-index, 部署 0-index] のタプル配列へ変換する。
 * 未定義（性質が該当しない場合）や長さ2でない要素は除外する。
 */
export function normalizeBlockingPairs(
  pairs: number[][] | undefined,
): [number, number][] {
  return (pairs ?? []).flatMap((pair) => {
    const [employeeIndex, departmentIndex] = pair;
    return employeeIndex !== undefined && departmentIndex !== undefined
      ? ([[employeeIndex, departmentIndex]] as [number, number][])
      : [];
  });
}

export interface DepartmentAssignmentView {
  departmentIndex: number;
  name: string;
  capacity: number;
  /** 配属済み社員の 0-indexed 一覧（昇順）。 */
  assignedEmployeeIndices: readonly number[];
  /** 定員充足率（配属数 / 定員、0〜1）。定員0の場合は0。 */
  fillRate: number;
}

export function buildDepartmentAssignments(result: MatchingResult): DepartmentAssignmentView[] {
  return result.department_names.map((name, departmentIndex) => {
    const capacity = result.capacities[departmentIndex] ?? 0;
    const assignedEmployeeIndices = [...(result.receiver_match[departmentIndex] ?? [])].sort(
      (a, b) => a - b,
    );
    return {
      departmentIndex,
      name,
      capacity,
      assignedEmployeeIndices,
      fillRate: capacity > 0 ? assignedEmployeeIndices.length / capacity : 0,
    };
  });
}

/**
 * 社員が指定部署に付けた希望順位（1始まり）を返す。リストに含まれない
 * （＝受け入れ不可能と申告した）場合は null。
 */
export function rankOfDepartmentForEmployee(
  proposerPrefs: readonly (readonly number[])[],
  employeeIndex: number,
  departmentIndex: number,
): number | null {
  const prefs = proposerPrefs[employeeIndex];
  if (prefs === undefined) {
    return null;
  }
  const position = prefs.indexOf(departmentIndex + 1);
  return position === -1 ? null : position + 1;
}

export interface EmployeeAssignmentRow {
  employeeIndex: number;
  employeeName: string;
  departmentIndex: number | null;
  departmentName: string | null;
  /** 配属先に対する本人の希望順位（1始まり）。未配属、または対象外の場合は null。 */
  rank: number | null;
}

export function buildEmployeeAssignmentRows(
  result: MatchingResult,
  proposerPrefs: readonly (readonly number[])[],
): EmployeeAssignmentRow[] {
  return result.employee_names.map((employeeName, employeeIndex) => {
    const departmentIndex = result.proposer_match[employeeIndex] ?? -1;
    if (departmentIndex === -1) {
      return {
        employeeIndex,
        employeeName,
        departmentIndex: null,
        departmentName: null,
        rank: null,
      };
    }
    return {
      employeeIndex,
      employeeName,
      departmentIndex,
      departmentName: result.department_names[departmentIndex] ?? null,
      rank: rankOfDepartmentForEmployee(proposerPrefs, employeeIndex, departmentIndex),
    };
  });
}
