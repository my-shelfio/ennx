/**
 * ダウンロードするファイル名に付ける日時を `YYYYMMDDhhmmss`（ローカル時刻、ゼロ埋め）で返す。
 * 区切り文字を含まないため、OS を問わずファイル名にそのまま使える。
 */
export function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
