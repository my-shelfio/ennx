import { describe, expect, test } from "vitest";

import { buildDepartmentBreakdown } from "./departmentBreakdown";
import { SAMPLE_RUNS } from "./sampleRuns.testdata";

describe.each(Object.entries(SAMPLE_RUNS))("サンプル %s", (_key, run) => {
  const { result, input } = run;

  test("受け入れた社員が配属結果（receiver_match）と一致し、希望者だけが並ぶ", () => {
    result.department_names.forEach((_, department) => {
      const breakdown = buildDepartmentBreakdown(
        result,
        input.proposer_prefs,
        input.receiver_prefs,
        department,
      );
      const accepted = breakdown.applicants
        .filter((applicant) => applicant.status === "accepted")
        .map((applicant) => applicant.employee)
        .sort((a, b) => a - b);
      expect(accepted).toEqual([...(result.receiver_match[department] ?? [])].sort((a, b) => a - b));

      const applied = input.proposer_prefs
        .map((prefs, employee) => (prefs.includes(department + 1) ? employee : -1))
        .filter((employee) => employee !== -1);
      expect(breakdown.applicants.map((applicant) => applicant.employee).sort((a, b) => a - b)).toEqual(
        applied,
      );
    });
  });

  test("受け入れられなかった社員は理由を持ち、配属先はこの部署より下位の希望か未配属", () => {
    result.department_names.forEach((_, department) => {
      const breakdown = buildDepartmentBreakdown(
        result,
        input.proposer_prefs,
        input.receiver_prefs,
        department,
      );
      for (const applicant of breakdown.applicants.filter((a) => a.status === "rejected")) {
        expect(applicant.cause).not.toBeNull();
        const assigned = result.proposer_match[applicant.employee] ?? -1;
        const prefs = input.proposer_prefs[applicant.employee] ?? [];
        if (assigned !== -1) {
          expect(prefs.indexOf(assigned + 1) + 1).toBeGreaterThan(applicant.preferenceRank);
        }
      }
    });
  });

  test("部署側の優先順位の昇順に並ぶ", () => {
    const breakdown = buildDepartmentBreakdown(result, input.proposer_prefs, input.receiver_prefs, 0);
    const ranks = breakdown.applicants.map((applicant) => applicant.priorityRank ?? Infinity);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

test("CA: 最終カットオフを部署の優先順位の上限（上位 N 位まで）に読み替え、他のアルゴリズムでは null", () => {
  const ca = SAMPLE_RUNS["ng-pair"];
  const breakdown = buildDepartmentBreakdown(
    ca.result,
    ca.input.proposer_prefs,
    ca.input.receiver_prefs,
    0,
  );
  // 社員 5 名・カットオフ 2 → 企画部の優先順位で上位 4 位まで。
  expect(breakdown.cutoff).toEqual({ value: 2, passRankLimit: 4 });
  // 石田（企画部の優先順位 5 位）はカットオフで外れ、青木（1 位）が受け入れられる。
  // 他の 3 名は企画部より上位の希望に配属されている。
  expect(breakdown.applicants.map((a) => [a.employee, a.status, a.cause?.kind ?? null])).toEqual([
    [0, "accepted", null],
    [2, "placedHigher", null],
    [3, "placedHigher", null],
    [4, "placedHigher", null],
    [1, "rejected", "cutoff"],
  ]);

  const da = SAMPLE_RUNS.unmatched;
  expect(
    buildDepartmentBreakdown(da.result, da.input.proposer_prefs, da.input.receiver_prefs, 0).cutoff,
  ).toBeNull();
});

test("DA: 上位の希望に配属された社員は placedHigher になる", () => {
  const { result, input } = SAMPLE_RUNS.unmatched;
  // 開発部（部署 2）を第 1 希望にした上田（社員 2）は開発部に配属、
  // 開発部を第 2 希望にした青木（社員 0）は企画部で落ちた後に開発部でも落ちる。
  const breakdown = buildDepartmentBreakdown(result, input.proposer_prefs, input.receiver_prefs, 2);
  const byEmployee = new Map(breakdown.applicants.map((a) => [a.employee, a.status]));
  expect(byEmployee.get(2)).toBe("accepted");
  expect(byEmployee.get(0)).toBe("rejected");
  // 石田（社員 1）は企画部（第 1 希望）に配属済みのため、第 3 希望の開発部は placedHigher。
  expect(byEmployee.get(1)).toBe("placedHigher");
});
