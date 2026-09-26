import { describe, expect, it } from "vitest";

import { fractionToNumber, fractionToPercent, isZeroFraction } from "./fraction";

describe("fractionToNumber", () => {
  it("分数文字列を数値に変換する", () => {
    expect(fractionToNumber("1/2")).toBe(0.5);
    expect(fractionToNumber("71/96")).toBeCloseTo(0.7395833, 6);
  });

  it("整数表現をそのまま数値にする", () => {
    expect(fractionToNumber("0")).toBe(0);
    expect(fractionToNumber("1")).toBe(1);
    expect(fractionToNumber("3")).toBe(3);
  });

  it("解釈できない文字列は 0 にフォールバックする", () => {
    expect(fractionToNumber("")).toBe(0);
    expect(fractionToNumber("abc")).toBe(0);
    expect(fractionToNumber("1/0")).toBe(0);
    expect(fractionToNumber("1/x")).toBe(0);
  });
});

describe("fractionToPercent", () => {
  it("百分率の文字列にする", () => {
    expect(fractionToPercent("1/2")).toBe("50.0%");
    expect(fractionToPercent("1/3", 2)).toBe("33.33%");
  });
});

describe("isZeroFraction", () => {
  it("0 を判定する（表現によらず数値で判定する）", () => {
    expect(isZeroFraction("0")).toBe(true);
    expect(isZeroFraction("0/5")).toBe(true);
    expect(isZeroFraction("1/96")).toBe(false);
  });
});
