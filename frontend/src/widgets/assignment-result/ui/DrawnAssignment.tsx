import type { AssignmentResult } from "../../../entities/assignment";
import { UNASSIGNED } from "../../../entities/assignment";
import { Badge } from "../../../shared/ui";

interface DrawnAssignmentProps {
  result: AssignmentResult;
}

/**
 * 抽選 1 回分の配属。
 *
 * 期待割当（確率）は「配れる形」ではないため、くじを 1 回引いた結果を配属案として示す。
 * 同じ入力と同じシードなら誰が再実行しても同じ結果になるので、抽選が恣意的でないことを
 * 後から確認できる。
 */
export function DrawnAssignment({ result }: DrawnAssignmentProps) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-2 sm:grid-cols-2">
        {result.employee_names.map((name, employee) => {
          const department = result.drawn_assignment[employee] ?? UNASSIGNED;
          return (
            <li
              key={name}
              className="flex items-center justify-between rounded-control border border-slate-200 px-3 py-2 text-sm"
            >
              <span className="text-slate-700">{name}</span>
              <span
                className={
                  department === UNASSIGNED ? "text-slate-400" : "font-medium text-slate-900"
                }
              >
                {department === UNASSIGNED
                  ? "未配属"
                  : (result.department_names[department] ?? `部署${department + 1}`)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge variant="neutral">シード {result.seed}</Badge>
        同じ希望順位・同じシードで実行すれば、この配属を再現できます。
      </p>
    </div>
  );
}
