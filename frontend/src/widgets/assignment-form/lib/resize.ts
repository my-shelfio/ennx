import type { AssignmentInput } from "../../../entities/assignment";

/** 社員数を変更した入力を返す（希望順位は保持し、増減分だけ調整する）。 */
export function withEmployeeCount(input: AssignmentInput, count: number): AssignmentInput {
  const agentPrefs = Array.from({ length: count }, (_, index) => input.agent_prefs[index] ?? []);
  const employeeNames = input.employee_names
    ? Array.from({ length: count }, (_, index) => input.employee_names?.[index] ?? "")
    : null;
  return {
    ...input,
    agent_prefs: agentPrefs,
    employee_names: employeeNames,
    // 社員 index を参照する追加制約は、人数が変わると意味が変わるため破棄する。
    constraints: input.agent_prefs.length === count ? (input.constraints ?? null) : null,
  };
}

/** 部署数を変更した入力を返す（範囲外になった希望順位・制約は取り除く）。 */
export function withDepartmentCount(input: AssignmentInput, count: number): AssignmentInput {
  const capacities = Array.from({ length: count }, (_, index) => input.capacities[index] ?? 1);
  const departmentNames = input.department_names
    ? Array.from({ length: count }, (_, index) => input.department_names?.[index] ?? "")
    : null;
  return {
    ...input,
    capacities,
    department_names: departmentNames,
    agent_prefs: input.agent_prefs.map((prefs) =>
      prefs.filter((department) => department >= 1 && department <= count),
    ),
    constraints: input.capacities.length === count ? (input.constraints ?? null) : null,
  };
}
