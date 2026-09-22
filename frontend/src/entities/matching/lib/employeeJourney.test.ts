import { describe, expect, test } from "vitest";

import { buildEmployeeJourney } from "./employeeJourney";
import { SAMPLE_RUNS } from "./sampleRuns.testdata";

const runs = Object.entries(SAMPLE_RUNS);

describe.each(runs)("サンプル %s", (_key, run) => {
  const { result, input } = run;
  const journeys = result.employee_names.map((_, employee) =>
    buildEmployeeJourney(result, input.proposer_prefs, employee),
  );

  test("経緯の確定先が配属結果と一致し、未配属なら確定ステップを持たない", () => {
    journeys.forEach((journey, employee) => {
      const assigned = result.proposer_match[employee];
      expect(journey.finalDepartment).toBe(assigned);
      const confirms = journey.steps.filter((step) => step.kind === "confirm");
      if (assigned === -1) {
        expect(confirms).toEqual([]);
      } else {
        expect(confirms.map((step) => step.department)).toEqual([assigned]);
      }
    });
  });

  test("各ステップはイベントログの該当イベントを指している", () => {
    journeys.forEach((journey) => {
      for (const step of journey.steps) {
        const event = result.events[step.stepIndex];
        expect(event).toBeDefined();
        expect(event?.receiver).toBe(step.department);
        // CA のカットオフ棄却は部署単位の cutoff_raise を根拠にする（proposer は null）。
        if (!(result.algorithm === "ca" && step.kind === "reject")) {
          expect(event?.proposer).toBe(journey.employee);
        }
      }
    });
  });

  test("配属先より上位の希望（未配属なら全希望）はすべて理由つきで棄却になっている", () => {
    journeys.forEach((journey, employee) => {
      const prefs = input.proposer_prefs[employee] ?? [];
      const assignedRank = journey.finalRank ?? prefs.length + 1;
      const rejected = journey.outcomes.filter((outcome) => outcome.status === "rejected");
      expect(rejected.map((outcome) => outcome.rank)).toEqual(
        prefs.map((_, index) => index + 1).filter((rank) => rank < assignedRank),
      );
      for (const outcome of rejected) {
        expect(outcome.cause).not.toBeNull();
      }
    });
  });
});

test("DA（定員不足）: 未配属の社員は希望した全部署で定員超過により棄却されている", () => {
  const { result, input } = SAMPLE_RUNS.unmatched;
  const journey = buildEmployeeJourney(result, input.proposer_prefs, 0);

  expect(journey.finalDepartment).toBe(-1);
  expect(journey.finalRank).toBeNull();
  expect(journey.outcomes.map((outcome) => [outcome.department, outcome.cause?.kind])).toEqual([
    [0, "capacity"],
    [2, "capacity"],
    [1, "capacity"],
  ]);
});

test("FDA（地域上限）: 首都圏を希望した社員の棄却理由に地域上限が含まれ、待機も経緯に残る", () => {
  const { result, input } = SAMPLE_RUNS["regional-cap"];
  // 上田（社員 2）: 横浜支社・東京本社を希望したが地域上限で入れず、大阪支社に配属。
  const journey = buildEmployeeJourney(result, input.proposer_prefs, 2);

  expect(journey.finalDepartment).toBe(2);
  expect(journey.finalRank).toBe(3);
  expect(journey.outcomes.slice(0, 2).map((outcome) => outcome.cause)).toEqual([
    { kind: "regionalCap", limit: 2 },
    { kind: "regionalCap", limit: 2 },
  ]);
  expect(journey.steps.some((step) => step.kind === "waitlist")).toBe(true);

  // 石田（社員 1）: 東京本社の待機リストに入った後、地域上限で棄却され、横浜支社に確定。
  const waitlisted = buildEmployeeJourney(result, input.proposer_prefs, 1);
  expect(waitlisted.steps.map((step) => [step.kind, step.department])).toEqual([
    ["propose", 0],
    ["waitlist", 0],
    ["reject", 0],
    ["propose", 1],
    ["hold", 1],
    ["confirm", 1],
  ]);
});

test("CA（NG ペア）: カットオフの引き上げで第 1 希望から外れた社員は理由 cutoff で棄却になる", () => {
  const { result, input } = SAMPLE_RUNS["ng-pair"];
  // 石田（社員 1）: 企画部（第 1 希望）でカットオフ 1 → 2 により外れ、開発部（第 2 希望）に確定。
  const journey = buildEmployeeJourney(result, input.proposer_prefs, 1);

  expect(journey.finalDepartment).toBe(2);
  expect(journey.finalRank).toBe(2);
  expect(journey.outcomes[0]).toEqual({
    department: 0,
    rank: 1,
    status: "rejected",
    cause: { kind: "cutoff", from: 1, to: 2 },
  });
  expect(journey.steps.map((step) => [step.kind, step.department])).toEqual([
    ["propose", 0],
    ["reject", 0],
    ["propose", 2],
    ["confirm", 2],
  ]);
});

test("FDA: 待機リストからの繰り上げ受入は確定として扱い、差し戻しは棄却に含めない", () => {
  const result = {
    algorithm: "fda",
    proposer_match: [0],
    events: [
      { round: 1, event_type: "propose", proposer: 0, receiver: 0, reason: null },
      { round: 1, event_type: "tentative_accept", proposer: 0, receiver: 0, reason: null },
      { round: 2, event_type: "reject", proposer: 0, receiver: 0, reason: "目標定員超過（待機リストへ差し戻し）" },
      { round: 2, event_type: "waitlist", proposer: 0, receiver: 0, reason: "目標定員超過（待機リストへ差し戻し）" },
      { round: 2, event_type: "promote", proposer: 0, receiver: 0, reason: "輪番指名による繰り上げ" },
    ],
  };

  const journey = buildEmployeeJourney(result, [[1]], 0);

  expect(journey.steps.map((step) => step.kind)).toEqual([
    "propose",
    "hold",
    "waitlist",
    "promote",
    "confirm",
  ]);
  expect(journey.steps.at(-1)?.stepIndex).toBe(4);
  expect(journey.outcomes).toEqual([{ department: 0, rank: 1, status: "assigned", cause: null }]);
});
