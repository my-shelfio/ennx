import type { VotingResults } from "../../../entities/voting";

export interface VotingResultsExportJson {
  exported_at: string;
  results: VotingResults;
}

/** 投票結果のJSONエクスポート内容を組み立てる(全量、集計・比較・性質レポートを含む)。 */
export function buildVotingResultsJsonExport(
  results: VotingResults,
  now: Date = new Date(),
): VotingResultsExportJson {
  return {
    exported_at: now.toISOString(),
    results,
  };
}
