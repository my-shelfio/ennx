import { describe, expect, it } from "vitest";

import { formatRemaining } from "./formatRemaining";

const now = new Date("2026-09-27T09:00:00Z");

function after(ms: number): Date {
  return new Date(now.getTime() + ms);
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatRemaining", () => {
  it("残り数日は日と時間で表示し、強調しない", () => {
    expect(formatRemaining(after(2 * DAY + 5 * HOUR + 30 * MINUTE), now)).toEqual({
      text: "あと2日5時間",
      isUrgent: false,
      isOver: false,
    });
    expect(formatRemaining(after(3 * DAY), now).text).toBe("あと3日");
  });

  it("残り数時間は時間と分で表示し、24時間以内は強調する", () => {
    expect(formatRemaining(after(3 * HOUR + 10 * MINUTE), now)).toEqual({
      text: "あと3時間10分",
      isUrgent: true,
      isOver: false,
    });
    expect(formatRemaining(after(DAY), now)).toEqual({
      text: "あと1日",
      isUrgent: true,
      isOver: false,
    });
    expect(formatRemaining(after(DAY + 1), now).isUrgent).toBe(false);
  });

  it("残り1時間未満は分で表示し、端数の秒は切り上げる", () => {
    expect(formatRemaining(after(30 * MINUTE), now).text).toBe("締切まで30分");
    expect(formatRemaining(after(1000), now).text).toBe("締切まで1分");
    expect(formatRemaining(after(59 * MINUTE + 1000), now).text).toBe("あと1時間");
  });

  it("締切ちょうど・超過は締切済みとして扱う", () => {
    expect(formatRemaining(now, now)).toEqual({
      text: "締切を過ぎました",
      isUrgent: false,
      isOver: true,
    });
    expect(formatRemaining(after(-HOUR), now).isOver).toBe(true);
  });
});
