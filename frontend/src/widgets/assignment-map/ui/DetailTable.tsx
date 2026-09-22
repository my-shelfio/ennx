import { useState } from "react";

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
  /** 「第 N 希望以下のみ」の絞り込みに使うしきい値（既定: 3）。 */
  followUpThreshold?: number;
}

type RowFilter = "all" | "followUp" | "unmatched";
type RowSort = "employee" | "rankDesc";

/** 絞り込み・並べ替えを適用する。未配属・希望外は「希望から最も遠い」として扱う。 */
function applyFilterAndSort(
  rows: readonly EmployeeAssignmentRow[],
  filter: RowFilter,
  sort: RowSort,
  threshold: number,
): EmployeeAssignmentRow[] {
  const filtered = rows.filter((row) => {
    if (filter === "unmatched") {
      return row.departmentIndex === null;
    }
    if (filter === "followUp") {
      return row.rank === null || row.rank >= threshold;
    }
    return true;
  });
  if (sort === "employee") {
    return filtered;
  }
  return [...filtered].sort(
    (a, b) =>
      (b.rank ?? Number.POSITIVE_INFINITY) - (a.rank ?? Number.POSITIVE_INFINITY) ||
      a.employeeIndex - b.employeeIndex,
  );
}

const SELECT_CLASS =
  "h-9 rounded-control border border-slate-300 bg-white px-2 text-sm text-slate-900";

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
 * 「第 N 希望以下のみ」「未配属のみ」の絞り込みと、希望順位（希望から遠い順）での並べ替えができる。
 */
export function DetailTable({
  result,
  proposerPrefs,
  selectedEmployeeIndex = null,
  onSelectEmployee,
  followUpThreshold = 3,
}: DetailTableProps) {
  const [filter, setFilter] = useState<RowFilter>("all");
  const [sort, setSort] = useState<RowSort>("employee");
  const rows = applyFilterAndSort(
    buildEmployeeAssignmentRows(result, proposerPrefs),
    filter,
    sort,
    followUpThreshold,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 print:hidden">
        <label className="flex items-center gap-2">
          絞り込み
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as RowFilter)}
            className={SELECT_CLASS}
          >
            <option value="all">すべて</option>
            <option value="followUp">第{followUpThreshold}希望以下・未配属</option>
            <option value="unmatched">未配属のみ</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          並べ替え
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as RowSort)}
            className={SELECT_CLASS}
          >
            <option value="employee">社員順</option>
            <option value="rankDesc">希望順位（希望から遠い順）</option>
          </select>
        </label>
        <span className="text-xs text-slate-400">{rows.length}名</span>
      </div>
      {rows.length === 0 && (
        <p className="text-sm text-slate-500">条件に当てはまる社員はいません。</p>
      )}

      <div className="hidden md:block print:block">
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

      <ul className="flex flex-col gap-3 md:hidden print:hidden">
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
    </div>
  );
}
