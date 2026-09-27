import type { PublicVotingResults, VotingResults } from "../../../entities/voting";

export interface VotingResultsExportJson {
  exported_at: string;
  /** 主催者向けは投票者一覧を含み、参加者向けは含まない(受け取った結果をそのまま出力する)。 */
  results: VotingResults | PublicVotingResults;
}

/** 投票結果のJSONエクスポート内容を組み立てる(全量、集計・比較・性質レポートを含む)。 */
export function buildVotingResultsJsonExport(
  results: VotingResults | PublicVotingResults,
  now: Date = new Date(),
): VotingResultsExportJson {
  return {
    exported_at: now.toISOString(),
    results,
  };
}
