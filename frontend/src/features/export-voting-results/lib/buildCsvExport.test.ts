import { describe, expect, it } from "vitest";

import type { VotingResults } from "../../../entities/voting";

import { buildVotingResultsCsv } from "./buildCsvExport";

const rule = { rule: "plurality", scores: [2, 1], ranking: [0, 1], winners: [0] };

const results: VotingResults = {
  title: "会場の選定",
  options: ["案A", "案B"],
  option_descriptions: ["費用は高め, 駅近", ""],
  method: "plurality",
  ballot_count: 3,
  primary: rule,
  comparison: [rule],
  report: [],
  voters: ["v1", "v2", "v3"],
};

describe("buildVotingResultsCsv", () => {
  it("比較表の各行に選択肢の補足説明を含める(説明なしは空欄)", () => {
    const lines = buildVotingResultsCsv(results).split("\r\n");
    expect(lines[0]).toBe("選択肢,補足説明,多数決");
    expect(lines[1]).toBe('案A,"費用は高め, 駅近",2');
    expect(lines[2]).toBe("案B,,1");
  });
});
