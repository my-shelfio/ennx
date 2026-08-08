import type { MatchingResult } from "../../../entities/matching";
import { normalizeBlockingPairs } from "../../../entities/matching";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/ui";
import { buildDepartmentAssignments, rankOfDepartmentForEmployee } from "../lib/assignment";

export interface AssignmentMapProps {
  result: MatchingResult;
  /** 実行に使った選好リスト（社員→部署、1-indexed）。チップのホバー表示に使う。 */
  proposerPrefs: readonly (readonly number[])[];
}

function rankLabel(rank: number | null): string {
  if (rank === null) {
    return "希望対象外";
  }
  return `第${rank}希望`;
}

/**
 * 社員 0-index → その社員が関与するブロッキングペアの相手部署名一覧、を組み立てる。
 * 性質レポート（安定性・弱安定性）の blocking_pairs から算出する。
 */
function buildBlockingDepartmentNames(result: MatchingResult): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const item of result.report) {
    for (const [employeeIndex, departmentIndex] of normalizeBlockingPairs(item.blocking_pairs)) {
      const departmentName =
        result.department_names[departmentIndex] ?? `部署${departmentIndex + 1}`;
      const existing = map.get(employeeIndex) ?? [];
      if (!existing.includes(departmentName)) {
        existing.push(departmentName);
      }
      map.set(employeeIndex, existing);
    }
  }
  return map;
}

/**
 * 配属マップ（部署カード＋定員プログレスバー）。
 * 部署カードごとに配属社員のチップと定員プログレスバーを表示し、チップホバー/フォーカスで
 * その社員の希望順位を表示する。未配属者がいる場合は末尾に明示する。
 * 安定性・弱安定性が違反の場合、ブロッキングペアに関与する社員のチップを
 * 枠線でハイライトし、ツールチップに相手部署を明記する（数字併記でアクセシビリティに配慮）。
 */
export function AssignmentMap({ result, proposerPrefs }: AssignmentMapProps) {
  const departments = buildDepartmentAssignments(result);
  const blockingDepartmentNames = buildBlockingDepartmentNames(result);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((department) => {
          const fillPercent = Math.min(100, Math.round(department.fillRate * 100));
          return (
            <Card key={department.departmentIndex}>
              <CardHeader>
                <CardTitle>{department.name}</CardTitle>
                <CardDescription>
                  {department.assignedEmployeeIndices.length} / {department.capacity} 名
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div
                  role="progressbar"
                  aria-label={`${department.name}の定員充足率`}
                  aria-valuenow={fillPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 w-full overflow-hidden rounded-pill bg-slate-100"
                >
                  <div
                    className="h-full rounded-pill bg-gradient-brand"
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
                <ul className="flex flex-wrap gap-2">
                  {department.assignedEmployeeIndices.map((employeeIndex) => {
                    const employeeName = result.employee_names[employeeIndex] ?? `社員${employeeIndex + 1}`;
                    const rank = rankOfDepartmentForEmployee(
                      proposerPrefs,
                      employeeIndex,
                      department.departmentIndex,
                    );
                    const blockingDepartments = blockingDepartmentNames.get(employeeIndex);
                    const isBlocking = blockingDepartments !== undefined;
                    return (
                      <li key={employeeIndex} className="group relative">
                        <span
                          tabIndex={0}
                          className={
                            isBlocking
                              ? "inline-flex min-h-11 items-center rounded-pill bg-primary-50 px-3 py-1 text-sm text-primary-700 ring-2 ring-danger-500"
                              : "inline-flex min-h-11 items-center rounded-pill bg-primary-50 px-3 py-1 text-sm text-primary-700"
                          }
                        >
                          {employeeName}
                          {isBlocking ? <span className="ml-1" aria-hidden="true">⚠</span> : null}
                        </span>
                        <div
                          role="tooltip"
                          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-xs -translate-x-1/2 rounded-control bg-slate-900 px-3 py-2 text-xs text-white opacity-0 shadow-popover transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                        >
                          <p>{rankLabel(rank)}</p>
                          {isBlocking ? (
                            <p className="mt-1 border-t border-slate-700 pt-1 text-danger-100">
                              不安定: {blockingDepartments.join("、")}
                              をより希望しており、受け入れ可能な状態です
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {result.unmatched.length > 0 ? (
        <Card className="border-warning-100 bg-warning-50">
          <CardHeader>
            <CardTitle>未配属の社員（{result.unmatched.length}名）</CardTitle>
            <CardDescription>
              {result.unmatched
                .map((employeeIndex) => result.employee_names[employeeIndex] ?? `社員${employeeIndex + 1}`)
                .join("、")}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
