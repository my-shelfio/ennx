/** 保持期間（日数）の下限・上限・既定値（サーバー側の検証範囲と同じ）。 */
export const MIN_RETENTION_DAYS = 1;
export const MAX_RETENTION_DAYS = 30;
export const DEFAULT_RETENTION_DAYS = 7;

/** 発行時に選べる保持期間（日数）。いずれも下限〜上限の範囲内。 */
export const RETENTION_DAY_OPTIONS = [1, 3, 7, 14, 30] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 発行前の目安として、現在時刻から保持日数後の自動削除日時を返す。 */
export function estimateExpiresAt(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() + retentionDays * DAY_MS);
}

/** 自動削除日を「YYYY/MM/DD」（ローカル日付、ゼロ埋め）で返す。 */
export function formatDeletionDate(expiresAt: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${expiresAt.getFullYear()}/${pad(expiresAt.getMonth() + 1)}/${pad(expiresAt.getDate())}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * 自動削除日までの残り日数（ローカル日付の差。削除日が今日なら 0、過ぎていれば 0）。
 * 時刻の端数ではなく日付で数えるため、併記する削除日（`formatDeletionDate`）と常に整合する。
 */
export function daysUntilDeletion(expiresAt: Date, now: Date): number {
  // 夏時間の切り替えで 1 日が 24 時間でない場合に備えて四捨五入する。
  const days = Math.round(
    (startOfLocalDay(expiresAt).getTime() - startOfLocalDay(now).getTime()) / DAY_MS,
  );
  return Math.max(days, 0);
}

/**
 * 自動削除までの日数と削除日の案内文を返す
 * （例: 「7日後（2026/10/10）に自動削除されます」）。
 */
export function describeDeletion(expiresAt: Date, now: Date): string {
  if (expiresAt.getTime() <= now.getTime()) {
    return "有効期限を過ぎたため自動削除されます";
  }
  const days = daysUntilDeletion(expiresAt, now);
  const date = formatDeletionDate(expiresAt);
  return days === 0 ? `本日（${date}）自動削除されます` : `${days}日後（${date}）に自動削除されます`;
}
