import type { MatchingResult } from "../../../entities/matching";
import {
  Badge,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../shared/ui";
import { buildEmployeeAssignmentRows } from "../lib/assignment";
import type { EmployeeAssignmentRow } from "../lib/assignment";

export interface DetailTableProps {
  result: MatchingResult;
  /** 実行に使った選好リスト（社員→部署、1-indexed）。希望順位列の算出に使う。 */
  proposerPrefs: readonly (readonly number[])[];
  /** 選択中の社員（0-indexed）。行を強調表示する。 */
  selectedEmployeeIndex?: number | null;
  /** 社員を選んだときのハンドラ。指定時は社員名をクリック可能にする。 */
  onSelectEmployee?: (employeeIndex: number) => void;
}

function AssignmentCell({ row }: { row: EmployeeAssignmentRow }) {
  if (row.departmentName === null) {
    return <Badge variant="warning">未配属</Badge>;
  }
  return <span>{row.departmentName}</span>;
}

function RankCell({ row }: { row: EmployeeAssignmentRow }) {
  if (row.rank === null) {
    return <span className="text-slate-400">―</span>;
  }
  return <span>第{row.rank}希望</span>;
}

function EmployeeNameCell({
  row,
  isSelected,
  onSelectEmployee,
}: {
  row: EmployeeAssignmentRow;
  isSelected: boolean;
  onSelectEmployee: ((employeeIndex: number) => void) | undefined;
}) {
  if (onSelectEmployee === undefined) {
    return <span className="font-medium text-slate-900">{row.employeeName}</span>;
  }
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={() => onSelectEmployee(row.employeeIndex)}
      className="text-left font-medium text-primary-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
    >
      {row.employeeName}
    </button>
  );
}

/**
 * 詳細テーブル。
 * デスクトップでは表形式、モバイル（`md` 未満）ではカードリストに切り替える。
 * `onSelectEmployee` を渡すと社員名から社員を選択できる（結果画面の説明パネル用）。
 */
export function DetailTable({
  result,
  proposerPrefs,
  selectedEmployeeIndex = null,
  onSelectEmployee,
}: DetailTableProps) {
  const rows = buildEmployeeAssignmentRows(result, proposerPrefs);

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>社員</TableHead>
              <TableHead>配属部署</TableHead>
              <TableHead>希望順位</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.employeeIndex}
                className={row.employeeIndex === selectedEmployeeIndex ? "bg-primary-50" : undefined}
              >
                <TableCell>
                  <EmployeeNameCell
                    row={row}
                    isSelected={row.employeeIndex === selectedEmployeeIndex}
                    onSelectEmployee={onSelectEmployee}
                  />
                </TableCell>
                <TableCell>
                  <AssignmentCell row={row} />
                </TableCell>
                <TableCell>
                  <RankCell row={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.employeeIndex}>
            <Card
              className={
                row.employeeIndex === selectedEmployeeIndex ? "ring-2 ring-primary-300" : undefined
              }
            >
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex flex-col gap-1">
                  <EmployeeNameCell
                    row={row}
                    isSelected={row.employeeIndex === selectedEmployeeIndex}
                    onSelectEmployee={onSelectEmployee}
                  />
                  <span className="text-sm text-slate-500">
                    <RankCell row={row} />
                  </span>
                </div>
                <AssignmentCell row={row} />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
