import { describe, expect, test } from "vitest";

import type { MatchingResult } from "../model/types";

import { buildEmployeeAssignmentRows } from "./assignment";
import {
  compareByDistanceFromPreference,
  extractFollowUpEmployees,
  FOLLOW_UP_THRESHOLDS,
  isFollowUpTarget,
} from "./followUp";
import { SAMPLE_RUNS } from "./sampleRuns.testdata";

function asResult(run: (typeof SAMPLE_RUNS)[keyof typeof SAMPLE_RUNS]): MatchingResult {
  return {
    ...run.result,
    constraint_type: "",
    capacities: run.result.receiver_match.map(() => 0),
    unmatched: run.result.proposer_match.flatMap((dept, i) => (dept === -1 ? [i] : [])),
    report: [],
  };
}

describe.each(Object.entries(SAMPLE_RUNS))("サンプル %s", (_key, run) => {
  const result = asResult(run);

  test.each(FOLLOW_UP_THRESHOLDS)("第 %i 希望以下: 詳細テーブルの行と一致する", (threshold) => {
    const rows = buildEmployeeAssignmentRows(result, run.input.proposer_prefs);
    const expected = rows
      .filter((row) => row.rank === null || row.rank >= threshold)
      .map((row) => [row.employeeIndex, row.departmentIndex, row.rank]);

    const followUps = extractFollowUpEmployees(result, run.input, threshold);

    expect(
      followUps
        .map((f) => [f.employeeIndex, f.departmentIndex, f.rank])
        .sort((a, b) => Number(a[0]) - Number(b[0])),
    ).toEqual(expected);
    // 未配属を先頭に、希望順位の降順。
    const ranks = followUps.map((f) => f.rank ?? Infinity);
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
  });
});

test("未配属の社員は第 1〜2 希望の棄却理由つきで先頭に並ぶ", () => {
  const run = SAMPLE_RUNS.unmatched;
  const followUps = extractFollowUpEmployees(asResult(run), run.input, 3);

  expect(followUps.slice(0, 2).map((f) => f.employeeIndex)).toEqual([0, 4]);
  expect(followUps[0]?.topChoices.map((c) => [c.rank, c.departmentName, c.cause?.kind])).toEqual([
    [1, "企画部", "capacity"],
    [2, "開発部", "capacity"],
  ]);
});

test("詳細テーブルと共用する判定・並び順: 第 N 希望以下と未配属・希望外が対象で、希望から遠い順に並ぶ", () => {
  expect(isFollowUpTarget({ rank: null }, 3)).toBe(true);
  expect(isFollowUpTarget({ rank: 3 }, 3)).toBe(true);
  expect(isFollowUpTarget({ rank: 2 }, 3)).toBe(false);

  const rows = [
    { employeeIndex: 0, rank: 1 },
    { employeeIndex: 1, rank: null },
    { employeeIndex: 2, rank: 3 },
    { employeeIndex: 3, rank: 3 },
    { employeeIndex: 4, rank: null },
  ];
  expect([...rows].sort(compareByDistanceFromPreference).map((row) => row.employeeIndex)).toEqual([
    1, 4, 2, 3, 0,
  ]);
});
