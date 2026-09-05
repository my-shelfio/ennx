import { fractionToNumber, UNASSIGNED } from "../../../entities/assignment";
import type { AssignmentResult, LotteryTerm } from "../../../entities/assignment";

/** くじの 1 項を「誰がどこへ」の読み下し文にする。 */
export function describeTerm(term: LotteryTerm, result: AssignmentResult): string {
  return term.assignment
    .map((department, employee) => {
      const name = result.employee_names[employee];
      const target =
        department === UNASSIGNED
          ? "未配属"
          : (result.department_names[department] ?? `部署${department + 1}`);
      return `${name}→${target}`;
    })
    .join("、");
}

/** 部署ごとの配属人数の期待値（期待割当の列合計）。 */
export function expectedHeadcounts(result: AssignmentResult): number[] {
  return result.department_names.map((_, department) =>
    result.expected_assignment.reduce(
      (sum, row) => sum + fractionToNumber(row[department] ?? "0"),
      0,
    ),
  );
}

/** 未配属になる人数の期待値（∅ 列の合計）。 */
export function expectedUnassigned(result: AssignmentResult): number {
  const emptyColumn = result.department_names.length;
  return result.expected_assignment.reduce(
    (sum, row) => sum + fractionToNumber(row[emptyColumn] ?? "0"),
    0,
  );
}
