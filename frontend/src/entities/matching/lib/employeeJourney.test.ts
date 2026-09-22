import { describe, expect, test } from "vitest";

import { buildEmployeeJourney } from "./employeeJourney";
import { SAMPLE_RUNS } from "./sampleRuns.testdata";

const runs = Object.entries(SAMPLE_RUNS);

describe.each(runs)("サンプル %s", (_key, run) => {
  const { result, input } = run;
  const journeys = result.employee_names.map((_, employee) =>
    buildEmployeeJourney(result, input, employee),
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
        // 「受け入れ候補外」は部署の優先順位リストに本当に含まれていない場合に限る。
        if (outcome.cause?.kind === "unacceptable") {
          expect(input.receiver_prefs[outcome.department]).not.toContain(employee + 1);
        }
      }
    });
  });
});

test("DA（定員不足）: 未配属の社員は希望した全部署で定員超過により棄却されている", () => {
  const { result, input } = SAMPLE_RUNS.unmatched;
  const journey = buildEmployeeJourney(result, input, 0);

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
  const journey = buildEmployeeJourney(result, input, 2);

  expect(journey.finalDepartment).toBe(2);
  expect(journey.finalRank).toBe(3);
  expect(journey.outcomes.slice(0, 2).map((outcome) => outcome.cause)).toEqual([
    { kind: "regionalCap", limit: 2 },
    { kind: "regionalCap", limit: 2 },
  ]);
  expect(journey.steps.some((step) => step.kind === "waitlist")).toBe(true);

  // 石田（社員 1）: 東京本社の待機リストに入った後、地域上限で棄却され、横浜支社に確定。
  const waitlisted = buildEmployeeJourney(result, input, 1);
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
  const journey = buildEmployeeJourney(result, input, 1);

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

  const journey = buildEmployeeJourney(result, { proposer_prefs: [[1]], receiver_prefs: [[1]] }, 0);

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

test("CA: 上位の部署を需要している間に足切りで外れた下位の希望部署も、カットオフによる棄却として説明する", () => {
  // 社員 0 は部署 1 → 部署 0 → 部署 2 の順に希望。部署 1 を需要している間（ラウンド 2）に
  // 部署 0 のカットオフが 1 → 2 に上がって足切り（部署 0 の優先順位 4 位 / 社員 4 名）から外れ、
  // 部署 1 を外れた後は部署 0 を飛ばして部署 2 に移る。
  const prefs = {
    proposer_prefs: [[2, 1, 3], [2, 3, 1], [2, 1, 3], [1, 3, 2]],
    receiver_prefs: [[4, 2, 3, 1], [4, 2, 1, 3], [4, 1, 3, 2]],
  };
  const result = {
    algorithm: "ca",
    proposer_match: [2, 1, -1, 0],
    events: [
      { round: 1, event_type: "propose", proposer: 3, receiver: 0, reason: "カットオフ 1 のもとで需要に含まれる" },
      { round: 1, event_type: "propose", proposer: 0, receiver: 1, reason: "カットオフ 1 のもとで需要に含まれる" },
      { round: 1, event_type: "propose", proposer: 1, receiver: 1, reason: "カットオフ 1 のもとで需要に含まれる" },
      { round: 1, event_type: "propose", proposer: 2, receiver: 1, reason: "カットオフ 1 のもとで需要に含まれる" },
      { round: 1, event_type: "cutoff_raise", proposer: null, receiver: 1, reason: "制約超過によりカットオフを 1 → 2 に引き上げ" },
      { round: 2, event_type: "propose", proposer: 2, receiver: 0, reason: "カットオフ 1 のもとで需要に含まれる" },
      { round: 2, event_type: "propose", proposer: 3, receiver: 0, reason: "カットオフ 1 のもとで需要に含まれる" },
      { round: 2, event_type: "propose", proposer: 0, receiver: 1, reason: "カットオフ 2 のもとで需要に含まれる" },
      { round: 2, event_type: "propose", proposer: 1, receiver: 1, reason: "カットオフ 2 のもとで需要に含まれる" },
      { round: 2, event_type: "cutoff_raise", proposer: null, receiver: 0, reason: "制約超過によりカットオフを 1 → 2 に引き上げ" },
      { round: 2, event_type: "cutoff_raise", proposer: null, receiver: 1, reason: "制約超過によりカットオフを 2 → 3 に引き上げ" },
      { round: 3, event_type: "propose", proposer: 2, receiver: 0, reason: "カットオフ 2 のもとで需要に含まれる" },
      { round: 3, event_type: "propose", proposer: 3, receiver: 0, reason: "カットオフ 2 のもとで需要に含まれる" },
      { round: 3, event_type: "propose", proposer: 1, receiver: 1, reason: "カットオフ 3 のもとで需要に含まれる" },
      { round: 3, event_type: "propose", proposer: 0, receiver: 2, reason: "カットオフ 1 のもとで需要に含まれる" },
      { round: 3, event_type: "cutoff_raise", proposer: null, receiver: 0, reason: "制約超過によりカットオフを 2 → 3 に引き上げ" },
      { round: 4, event_type: "propose", proposer: 3, receiver: 0, reason: "カットオフ 3 のもとで需要に含まれる" },
      { round: 4, event_type: "propose", proposer: 1, receiver: 1, reason: "カットオフ 3 のもとで需要に含まれる" },
      { round: 4, event_type: "propose", proposer: 0, receiver: 2, reason: "カットオフ 1 のもとで需要に含まれる" },
      { round: 4, event_type: "propose", proposer: 2, receiver: 2, reason: "カットオフ 1 のもとで需要に含まれる" },
      { round: 4, event_type: "cutoff_raise", proposer: null, receiver: 2, reason: "制約超過によりカットオフを 1 → 2 に引き上げ" },
      { round: 5, event_type: "propose", proposer: 3, receiver: 0, reason: "カットオフ 3 のもとで需要に含まれる" },
      { round: 5, event_type: "propose", proposer: 1, receiver: 1, reason: "カットオフ 3 のもとで需要に含まれる" },
      { round: 5, event_type: "propose", proposer: 0, receiver: 2, reason: "カットオフ 2 のもとで需要に含まれる" },
      { round: 5, event_type: "propose", proposer: 2, receiver: 2, reason: "カットオフ 2 のもとで需要に含まれる" },
      { round: 5, event_type: "cutoff_raise", proposer: null, receiver: 2, reason: "制約超過によりカットオフを 2 → 3 に引き上げ" },
      { round: 6, event_type: "propose", proposer: 3, receiver: 0, reason: "カットオフ 3 のもとで需要に含まれる" },
      { round: 6, event_type: "propose", proposer: 1, receiver: 1, reason: "カットオフ 3 のもとで需要に含まれる" },
      { round: 6, event_type: "propose", proposer: 0, receiver: 2, reason: "カットオフ 3 のもとで需要に含まれる" },
      { round: 6, event_type: "tentative_accept", proposer: 3, receiver: 0, reason: "不動点カットオフのもとで確定受入" },
      { round: 6, event_type: "tentative_accept", proposer: 1, receiver: 1, reason: "不動点カットオフのもとで確定受入" },
      { round: 6, event_type: "tentative_accept", proposer: 0, receiver: 2, reason: "不動点カットオフのもとで確定受入" },
    ],
  };

  const journey = buildEmployeeJourney(result, prefs, 0);

  expect(journey.finalDepartment).toBe(2);
  expect(journey.outcomes.map((outcome) => [outcome.department, outcome.status, outcome.cause])).toEqual([
    [1, "rejected", { kind: "cutoff", from: 2, to: 3 }],
    [0, "rejected", { kind: "cutoff", from: 1, to: 2 }],
    [2, "assigned", null],
  ]);
  // 飛ばした部署の棄却は、足切りから外れた cutoff_raise（ラウンド 2・部署 0）を指す。
  const skipped = journey.steps.find((step) => step.kind === "reject" && step.department === 0);
  expect(skipped?.round).toBe(2);
  expect(result.events[skipped?.stepIndex ?? -1]?.event_type).toBe("cutoff_raise");
  // 時系列はイベント順に並ぶ。
  const indices = journey.steps.map((step) => step.stepIndex);
  expect(indices).toEqual([...indices].sort((a, b) => a - b));
});

test("FDA: 押し出し直後に同じ部署の待機リストへ回った場合は棄却ではなく待機として扱う", () => {
  const result = {
    algorithm: "fda",
    proposer_match: [1],
    events: [
      { round: 1, event_type: "propose", proposer: 0, receiver: 0, reason: null },
      { round: 1, event_type: "tentative_accept", proposer: 0, receiver: 0, reason: null },
      { round: 2, event_type: "reject", proposer: 0, receiver: 0, reason: "定員超過（優先順位の高い提案者に押し出し）" },
      { round: 2, event_type: "waitlist", proposer: 0, receiver: 0, reason: "定員超過（待機リストへ）" },
      { round: 2, event_type: "reject", proposer: 0, receiver: 0, reason: "地域上限（1人）超過" },
      { round: 3, event_type: "propose", proposer: 0, receiver: 1, reason: null },
      { round: 3, event_type: "tentative_accept", proposer: 0, receiver: 1, reason: null },
    ],
  };

  const journey = buildEmployeeJourney(result, { proposer_prefs: [[1, 2]], receiver_prefs: [[1], [1]] }, 0);

  expect(journey.steps.map((step) => [step.kind, step.cause?.kind ?? null])).toEqual([
    ["propose", null],
    ["hold", null],
    ["waitlist", null],
    ["reject", "regionalCap"],
    ["propose", null],
    ["hold", null],
    ["confirm", null],
  ]);
});
