import { expect, test } from "vitest";

import {
  classifyRejectReason,
  describeRejectionCause,
  isReturnToWaitlist,
  parseCutoffRaise,
} from "./rejectionCause";

test("サーバーの棄却理由の文言を構造化した理由に分類する", () => {
  expect(classifyRejectReason("定員超過")).toEqual({ kind: "capacity" });
  expect(classifyRejectReason("定員超過（優先順位の高い提案者に押し出し）")).toEqual({
    kind: "displaced",
  });
  expect(classifyRejectReason("受け入れ不可能")).toEqual({ kind: "unacceptable" });
  expect(classifyRejectReason("設置上限（3人）超過")).toEqual({ kind: "maxCap", limit: 3 });
  expect(classifyRejectReason("地域上限（12人）超過")).toEqual({ kind: "regionalCap", limit: 12 });
});

test("未知の文言は原文のまま保持し、説明文にもそのまま使う", () => {
  const cause = classifyRejectReason("新しい理由");
  expect(cause).toEqual({ kind: "unknown", text: "新しい理由" });
  expect(describeRejectionCause(cause, "営業部")).toBe("新しい理由");
  expect(describeRejectionCause({ kind: "regionalCap", limit: 2 })).toBe(
    "所属する地域の受け入れ上限（2人）に達していた",
  );
  expect(classifyRejectReason(null)).toEqual({ kind: "unknown", text: "" });
});

test("待機リストへの差し戻しとカットオフ引き上げの文言を判定・解析する", () => {
  expect(isReturnToWaitlist("目標定員超過（待機リストへ差し戻し）")).toBe(true);
  expect(isReturnToWaitlist("定員超過")).toBe(false);
  expect(parseCutoffRaise("制約超過によりカットオフを 3 → 4 に引き上げ")).toEqual({ from: 3, to: 4 });
  expect(parseCutoffRaise("想定外")).toBeNull();
});
