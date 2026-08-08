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

/**
 * 詳細テーブル。
 * デスクトップでは表形式、モバイル（`md` 未満）ではカードリストに切り替える。
 */
export function DetailTable({ result, proposerPrefs }: DetailTableProps) {
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
              <TableRow key={row.employeeIndex}>
                <TableCell>{row.employeeName}</TableCell>
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
            <Card>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-slate-900">{row.employeeName}</span>
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
