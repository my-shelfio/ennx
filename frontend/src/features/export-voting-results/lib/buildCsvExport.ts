import type { VotingResults } from "../../../entities/voting";
import { RULE_LABELS } from "../../../entities/voting";
import { toCsvRow } from "../../../shared/lib";

/**
 * 投票結果のCSVエクスポート。
 * 1. 選択肢×ルール別スコアの比較表
 * 2. 性質レポート（ラベル・判定・詳細）
 * の2セクションを空行区切りで1ファイルにまとめる（結果・性質レポートをエクスポートし、関係者への説明に使う）。
 */
export function buildVotingResultsCsv(results: VotingResults): string {
  const comparisonHeader = [
    "選択肢",
    ...results.comparison.map((rule) => RULE_LABELS[rule.rule] ?? rule.rule),
  ];
  const comparisonRows = results.options.map((option, index) =>
    toCsvRow([option, ...results.comparison.map((rule) => String(rule.scores[index] ?? ""))]),
  );

  const reportHeader = ["性質レポート項目", "判定", "詳細"];
  const reportRows = results.report.map((item) =>
    toCsvRow([item.label, item.status, item.detail]),
  );

  return [
    toCsvRow(comparisonHeader),
    ...comparisonRows,
    "",
    toCsvRow(reportHeader),
    ...reportRows,
  ].join("\r\n");
}
