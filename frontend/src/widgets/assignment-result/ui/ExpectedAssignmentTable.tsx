import { fractionToNumber, isZeroFraction } from "../../../entities/assignment";
import type { AssignmentResult } from "../../../entities/assignment";

interface ExpectedAssignmentTableProps {
  result: AssignmentResult;
}

/**
 * 期待割当行列。各セルは「その社員がその部署に配属される確率」を厳密な分数で示す。
 *
 * 丸めた小数ではなく分数をそのまま出すのは、行の合計がちょうど 1 になることを
 * 目で確かめられるようにするため。セルの背景の濃さで大小を補助的に示す。
 */
export function ExpectedAssignmentTable({ result }: ExpectedAssignmentTableProps) {
  const columns = [...result.department_names, "未配属"];

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">期待割当行列</caption>
        <thead className="border-b border-slate-200">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">社員</th>
            {columns.map((label) => (
              <th key={label} className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {result.expected_assignment.map((row, employee) => (
            <tr key={employee}>
              <th scope="row" className="px-3 py-2 text-left font-medium text-slate-700">
                {result.employee_names[employee]}
              </th>
              {row.map((value, column) => (
                <td
                  key={column}
                  className="px-3 py-2 text-right tabular-nums"
                  style={{
                    backgroundColor: isZeroFraction(value)
                      ? undefined
                      : `rgba(37, 99, 235, ${0.08 + fractionToNumber(value) * 0.24})`,
                  }}
                >
                  {isZeroFraction(value) ? <span className="text-slate-300">0</span> : value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
