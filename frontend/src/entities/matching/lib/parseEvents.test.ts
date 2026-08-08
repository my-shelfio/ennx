import { expect, test } from "vitest";

import type { MatchingEvent } from "../model/types";

import { parseMatchingEvents } from "./parseEvents";

function event(partial: Partial<MatchingEvent> & Pick<MatchingEvent, "event_type">): MatchingEvent {
  return {
    round: 1,
    proposer: null,
    receiver: 0,
    reason: null,
    ...partial,
  };
}

test("propose は割り当て状態を変化させない", () => {
  const events = [event({ event_type: "propose", proposer: 0, receiver: 0 })];
  const steps = parseMatchingEvents(events, 2, 2);

  expect(steps).toHaveLength(1);
  expect(steps[0]?.proposerMatch).toEqual([-1, -1]);
  expect(steps[0]?.receiverMatch).toEqual([[], []]);
});

test("tentative_accept で割り当てられ、reject で解除される", () => {
  const events: MatchingEvent[] = [
    event({ event_type: "propose", proposer: 0, receiver: 0 }),
    event({ event_type: "propose", proposer: 1, receiver: 0 }),
    event({ event_type: "tentative_accept", proposer: 0, receiver: 0 }),
    event({ event_type: "reject", proposer: 1, receiver: 0 }),
    event({ event_type: "propose", proposer: 1, receiver: 1 }),
    event({ event_type: "tentative_accept", proposer: 1, receiver: 1 }),
  ];

  const steps = parseMatchingEvents(events, 2, 2);
  const final = steps.at(-1);

  expect(final?.proposerMatch).toEqual([0, 1]);
  expect(final?.receiverMatch).toEqual([[0], [1]]);
});

test("reject は割り当て済みの受入者と一致する場合のみ解除する（無関係な reject は無視）", () => {
  const events: MatchingEvent[] = [
    event({ event_type: "tentative_accept", proposer: 0, receiver: 0 }),
    // proposer 0 は receiver 1 に割り当てられていないので、この reject は無視される
    event({ event_type: "reject", proposer: 0, receiver: 1 }),
  ];

  const steps = parseMatchingEvents(events, 1, 2);

  expect(steps.at(-1)?.proposerMatch).toEqual([0]);
  expect(steps.at(-1)?.receiverMatch).toEqual([[0], []]);
});

test("tentative_accept の付け替え: 別の受入者に再割り当てされると元の受入者から外れる", () => {
  const events: MatchingEvent[] = [
    event({ event_type: "tentative_accept", proposer: 0, receiver: 0 }),
    event({ event_type: "tentative_accept", proposer: 0, receiver: 1 }),
  ];

  const steps = parseMatchingEvents(events, 1, 2);

  expect(steps[0]?.receiverMatch).toEqual([[0], []]);
  expect(steps[1]?.proposerMatch).toEqual([1]);
  expect(steps[1]?.receiverMatch).toEqual([[], [0]]);
});

test("promote は tentative_accept と同様に割り当てる（FDA）", () => {
  const events: MatchingEvent[] = [
    event({ event_type: "waitlist", proposer: 0, receiver: 0 }),
    event({ event_type: "promote", proposer: 0, receiver: 0 }),
  ];

  const steps = parseMatchingEvents(events, 1, 1);

  expect(steps[0]?.proposerMatch).toEqual([-1]);
  expect(steps[1]?.proposerMatch).toEqual([0]);
});

test("cutoff_raise（proposer が null）は割り当て状態を変化させない", () => {
  const events: MatchingEvent[] = [
    event({ event_type: "cutoff_raise", proposer: null, receiver: 0 }),
  ];

  const steps = parseMatchingEvents(events, 1, 1);

  expect(steps[0]?.proposerMatch).toEqual([-1]);
});

test("tentative_accept で proposer が null の場合はエラーを投げる", () => {
  const events: MatchingEvent[] = [
    event({ event_type: "tentative_accept", proposer: null, receiver: 0 }),
  ];

  expect(() => parseMatchingEvents(events, 1, 1)).toThrow();
});

test("reject で proposer が null の場合はエラーを投げる", () => {
  const events: MatchingEvent[] = [event({ event_type: "reject", proposer: null, receiver: 0 })];

  expect(() => parseMatchingEvents(events, 1, 1)).toThrow();
});
