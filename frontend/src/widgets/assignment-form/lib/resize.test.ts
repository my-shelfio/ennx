import { describe, expect, it } from "vitest";

import type { AssignmentInput } from "../../../entities/assignment";

import { withDepartmentCount, withEmployeeCount } from "./resize";

const base: AssignmentInput = {
  constraint_type: "general",
  capacities: [1, 1],
  agent_prefs: [[1, 2], [2, 1]],
  employee_names: ["佐藤", "鈴木"],
  department_names: ["営業", "開発"],
  constraints: [{ type: "ng_pair", params: { pairs: [[0, 1]] } }],
};

describe("withEmployeeCount", () => {
  it("社員を増やすと空の希望順位を追加する", () => {
    const next = withEmployeeCount(base, 3);

    expect(next.agent_prefs).toEqual([[1, 2], [2, 1], []]);
    expect(next.employee_names).toEqual(["佐藤", "鈴木", ""]);
  });

  it("社員数が変わると社員 index を参照する追加制約を破棄する", () => {
    expect(withEmployeeCount(base, 3).constraints).toBeNull();
    expect(withEmployeeCount(base, 2).constraints).toEqual(base.constraints);
  });
});

describe("withDepartmentCount", () => {
  it("部署を減らすと範囲外になった希望順位を取り除く", () => {
    const next = withDepartmentCount(base, 1);

    expect(next.capacities).toEqual([1]);
    expect(next.agent_prefs).toEqual([[1], [1]]);
    expect(next.department_names).toEqual(["営業"]);
  });

  it("部署を増やすと受け入れ人数の既定値を補う", () => {
    expect(withDepartmentCount(base, 3).capacities).toEqual([1, 1, 1]);
  });

  it("部署数が変わると追加制約を破棄する", () => {
    expect(withDepartmentCount(base, 3).constraints).toBeNull();
  });
});
