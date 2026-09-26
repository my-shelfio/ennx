import { describe, expect, it } from "vitest";

import type { AssignmentInput } from "../../../entities/assignment";

import { validateAssignmentInput } from "./validation";

const input = (overrides: Partial<AssignmentInput> = {}): AssignmentInput => ({
  constraint_type: "capacity_only",
  capacities: [1, 1],
  agent_prefs: [[1, 2], [2, 1]],
  ...overrides,
});

describe("validateAssignmentInput", () => {
  it("妥当な入力ではエラーを返さない", () => {
    expect(validateAssignmentInput(input())).toEqual([]);
  });

  it("希望順位が未入力の社員を検出する", () => {
    const errors = validateAssignmentInput(input({ agent_prefs: [[1], []] }));

    expect(errors).toContain("社員2の希望順位が未入力です。");
  });

  it("希望順位の重複を検出する", () => {
    const errors = validateAssignmentInput(input({ agent_prefs: [[1, 1], [2]] }));

    expect(errors).toContain("社員1の希望順位に同じ部署が重複しています。");
  });

  it("存在しない部署の指定を検出する", () => {
    const errors = validateAssignmentInput(input({ agent_prefs: [[3], [1]] }));

    expect(errors).toContain("社員1の希望順位に存在しない部署が含まれています。");
  });

  it("受け入れ人数が負の値を検出する", () => {
    const errors = validateAssignmentInput(input({ capacities: [-1, 1] }));

    expect(errors).toContain("受け入れ人数には 0 以上の整数を入力してください。");
  });

  it("受け入れ人数の合計が社員数に足りないことを警告する", () => {
    const errors = validateAssignmentInput(
      input({ capacities: [1, 0], agent_prefs: [[1], [1], [1]] }),
    );

    expect(errors.some((error) => error.includes("下回っています"))).toBe(true);
  });
});
