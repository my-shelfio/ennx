import { describe, expect, it } from "vitest";

import {
  daysUntilDeletion,
  describeDeletion,
  estimateExpiresAt,
  formatDeletionDate,
} from "./retention";

const NOW = new Date(2026, 9, 3, 10, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

describe("estimateExpiresAt", () => {
  it("現在時刻から保持日数 × 24 時間後の日時を返す（サーバーの期限計算と同じ）", () => {
    // 夏時間の切り替えを挟むタイムゾーンでも成り立つよう、期待値は経過時間で表す。
    expect(estimateExpiresAt(NOW, 7)).toEqual(new Date(NOW.getTime() + 7 * DAY_MS));
    expect(estimateExpiresAt(NOW, 30)).toEqual(new Date(NOW.getTime() + 30 * DAY_MS));
  });
});

describe("formatDeletionDate", () => {
  it("YYYY/MM/DD（ゼロ埋め）で返す", () => {
    expect(formatDeletionDate(new Date(2026, 0, 5, 23, 59))).toBe("2026/01/05");
  });
});

describe("daysUntilDeletion", () => {
  it("時刻の端数によらず、削除日までの日付の差を返す", () => {
    expect(daysUntilDeletion(new Date(2026, 9, 10, 10, 0, 0), NOW)).toBe(7);
    // 発行直後の数秒のずれで日数が増えない（削除日と食い違わない）。
    expect(daysUntilDeletion(new Date(2026, 9, 10, 10, 0, 5), NOW)).toBe(7);
    expect(daysUntilDeletion(new Date(2026, 9, 4, 0, 30, 0), NOW)).toBe(1);
    expect(daysUntilDeletion(new Date(2026, 9, 3, 23, 0, 0), NOW)).toBe(0);
    expect(daysUntilDeletion(new Date(2026, 9, 2), NOW)).toBe(0);
  });
});

describe("describeDeletion", () => {
  it("自動削除までの日数と削除日を案内する", () => {
    expect(describeDeletion(new Date(2026, 9, 10, 10, 0, 5), NOW)).toBe(
      "7日後（2026/10/10）に自動削除されます",
    );
  });

  it("削除日が今日なら「本日」と案内する", () => {
    expect(describeDeletion(new Date(2026, 9, 3, 23, 0, 0), NOW)).toBe(
      "本日（2026/10/03）自動削除されます",
    );
  });

  it("期限を過ぎていれば日付を出さない", () => {
    expect(describeDeletion(NOW, NOW)).toBe("有効期限を過ぎたため自動削除されます");
  });
});
