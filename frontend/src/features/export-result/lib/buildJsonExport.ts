import type { MatchingInput, MatchingResult } from "../../../entities/matching";

/**
 * エクスポート（JSON）の内容。設定・選好・結果・性質レポートの全量を含めるため、
 * `MatchingInput`（設定・選好の全フィールド）と `MatchingResult`（配属結果・
 * 性質レポート・イベントログを含む）をそのまま同梱する（フィールドの取捨選択による欠落を避ける）。
 */
export interface MatchingExportJson {
  exported_at: string;
  input: MatchingInput;
  result: MatchingResult;
}

export function buildJsonExport(
  input: MatchingInput,
  result: MatchingResult,
  now: Date = new Date(),
): MatchingExportJson {
  return {
    exported_at: now.toISOString(),
    input,
    result,
  };
}
