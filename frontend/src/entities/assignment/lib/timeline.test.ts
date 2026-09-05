import { describe, expect, it } from "vitest";

import type { AssignmentEvent } from "../model/types";

import { buildTimeline } from "./timeline";

const event = (overrides: Partial<AssignmentEvent>): AssignmentEvent => ({
  step: 1,
  event_type: "consume",
  start: "0",
  end: "1/2",
  employee: null,
  department: null,
  amount: null,
  constraint_index: null,
  reason: null,
  ...overrides,
});

describe("buildTimeline", () => {
  it("同じ step のイベントを 1 ステップにまとめる", () => {
    const timeline = buildTimeline(
      [
        event({ employee: 0, department: 0, amount: "1/2" }),
        event({ employee: 1, department: 1, amount: "1/2" }),
      ],
      2,
    );

    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.consumption).toEqual([0, 1]);
    expect(timeline[0]?.amount).toBe("1/2");
  });

  it("消費イベントのない社員は未配属（-1）として埋める", () => {
    const timeline = buildTimeline([event({ employee: 0, department: 0, amount: "1" })], 3);

    expect(timeline[0]?.consumption).toEqual([0, -1, -1]);
  });

  it("未配属（∅）の消費は -1 として記録する", () => {
    const timeline = buildTimeline([event({ employee: 0, department: -1, amount: "1" })], 1);

    expect(timeline[0]?.consumption).toEqual([-1]);
  });

  it("供給の枯渇・制約の飽和は注記として集める", () => {
    const timeline = buildTimeline(
      [
        event({ employee: 0, department: 0, amount: "1/2" }),
        event({ event_type: "supply_exhausted", department: 0, reason: "部署1 の供給数が尽きた" }),
        event({
          event_type: "constraint_saturated",
          constraint_index: 0,
          reason: "NG ペアが上限に達した",
        }),
      ],
      1,
    );

    expect(timeline[0]?.notes).toEqual(["部署1 の供給数が尽きた", "NG ペアが上限に達した"]);
  });

  it("step の昇順に並べ替える", () => {
    const timeline = buildTimeline(
      [
        event({ step: 2, employee: 0, department: 1, amount: "1/2", start: "1/2", end: "1" }),
        event({ step: 1, employee: 0, department: 0, amount: "1/2" }),
      ],
      1,
    );

    expect(timeline.map((step) => step.step)).toEqual([1, 2]);
  });
});
