import { describe, expect, it } from "vitest";

import { VOTING_METHODS } from "../../../entities/voting";

import { DECISION_GOAL_OPTIONS, recommendMethod } from "./recommendMethod";

describe("recommendMethod", () => {
  it.each([
    ["quick", "plurality"],
    ["narrow", "approval"],
    ["priority", "ranking"],
  ] as const)("回答 %s には %s を推奨する", (goal, method) => {
    expect(recommendMethod(goal).method).toBe(method);
  });

  it("すべての選択肢が推奨理由つきで作成可能な方式に対応し、方式の重複がない", () => {
    const methods = DECISION_GOAL_OPTIONS.map(({ goal }) => {
      const recommendation = recommendMethod(goal);
      expect(recommendation.reason.length).toBeGreaterThan(0);
      return recommendation.method;
    });
    expect(methods.every((method) => VOTING_METHODS.includes(method))).toBe(true);
    expect(new Set(methods).size).toBe(methods.length);
  });
});
