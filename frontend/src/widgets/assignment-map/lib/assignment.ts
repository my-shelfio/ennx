/**
 * 配属マップ・詳細テーブル向けのビューモデル算出。
 * 実体は entities/matching/lib/assignment（features/export-result と共有するため
 * entities 層へ移設）。widgets/assignment-map の既存の import 元
 * （`../lib/assignment`）を変更せずに済むよう、ここでは再エクスポートのみ行う。
 */
export {
  buildDepartmentAssignments,
  buildEmployeeAssignmentRows,
  rankOfDepartmentForEmployee,
} from "../../../entities/matching";
export type {
  DepartmentAssignmentView,
  EmployeeAssignmentRow,
} from "../../../entities/matching";
