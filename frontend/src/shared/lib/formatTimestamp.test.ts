import { describe, expect, it } from "vitest";

import { formatTimestamp } from "./formatTimestamp";

describe("formatTimestamp", () => {
  it("ローカル時刻を YYYYMMDDhhmmss で返す", () => {
    expect(formatTimestamp(new Date(2026, 8, 27, 14, 5, 9))).toBe("20260927140509");
  });

  it("1桁の月・日・時・分・秒をゼロ埋めする", () => {
    expect(formatTimestamp(new Date(2026, 0, 2, 3, 4, 5))).toBe("20260102030405");
  });

  it("日付の境界（年末の最終秒）を繰り上げずに返す", () => {
    expect(formatTimestamp(new Date(2025, 11, 31, 23, 59, 59))).toBe("20251231235959");
  });
});
