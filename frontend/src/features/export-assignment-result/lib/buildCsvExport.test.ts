import { describe, expect, it } from "vitest";

import type { AssignmentInput, AssignmentResult } from "../../../entities/assignment";

import {
  buildDrawnAssignmentCsv,
  buildExpectedAssignmentCsv,
  buildInputCsv,
} from "./buildCsvExport";

const input: AssignmentInput = {
  constraint_type: "capacity_only",
  capacities: [2, 1],
  agent_prefs: [
    [1, 2],
    [2, 1],
  ],
  employee_names: ["佐藤", "鈴木"],
  department_names: ["営業", "開発"],
};

const result: AssignmentResult = {
  constraint_type: "capacity_only",
  mechanism: "ps",
  employee_names: ["佐藤", "鈴木"],
  department_names: ["営業", "開発"],
  capacities: [2, 1],
  expected_assignment: [
    ["1/2", "0", "1/2"],
    ["0", "1", "0"],
  ],
  lottery: [],
  lottery_complete: false,
  drawn_assignment: [0, -1],
  seed: 42,
  report: [],
  events: [],
};

describe("buildDrawnAssignmentCsv", () => {
  it("社員ごとの配属先と抽選シードを出力する", () => {
    const lines = buildDrawnAssignmentCsv(result).split("\r\n");

    expect(lines[0]).toBe("社員名,配属先,抽選シード");
    expect(lines[1]).toBe("佐藤,営業,42");
    expect(lines[2]).toBe("鈴木,未配属,42");
  });
});

describe("buildExpectedAssignmentCsv", () => {
  it("厳密な分数と小数近似を並べて出力する", () => {
    const lines = buildExpectedAssignmentCsv(result).split("\r\n");

    expect(lines[0]).toBe("社員名,営業,営業（小数）,開発,開発（小数）,未配属,未配属（小数）");
    expect(lines[1]).toBe("佐藤,1/2,0.5,0,0,1/2,0.5");
    expect(lines[2]).toBe("鈴木,0,0,1,1,0,0");
  });

  it("解釈できない値は小数列を空にする", () => {
    const broken = { ...result, expected_assignment: [["1/0", "0", "0"]] };

    const lines = buildExpectedAssignmentCsv({
      ...broken,
      employee_names: ["佐藤"],
    }).split("\r\n");

    expect(lines[1]).toBe("佐藤,1/0,,0,0,0,0");
  });
});

describe("buildInputCsv", () => {
  it("受け入れ人数と希望順位を控えとして出力する", () => {
    const lines = buildInputCsv(input, result).split("\r\n");

    expect(lines[0]).toBe("種別,名前,値");
    expect(lines).toContain("受け入れ人数,営業,2");
    expect(lines).toContain("希望順位,佐藤,営業 > 開発");
    expect(lines).toContain("希望順位,鈴木,開発 > 営業");
  });
});
