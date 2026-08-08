import { useState } from "react";

import type { RuleResult, VotingResults } from "../../../entities/voting";
import { RULE_LABELS } from "../../../entities/voting";
import { ExportVotingResultsMenu } from "../../../features/export-voting-results";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../shared/ui";

export interface VotingResultsPanelProps {
  results: VotingResults;
}

const REPORT_BADGE: Record<string, { symbol: string; variant: "ok" | "danger" | "neutral" }> = {
  ok: { symbol: "✓", variant: "ok" },
  ng: { symbol: "✗", variant: "danger" },
  info: { symbol: "―", variant: "neutral" },
};

function winnerLabels(rule: RuleResult, options: string[]): string {
  return rule.winners.map((index) => options[index] ?? "").join("、");
}

/**
 * 投票結果画面。
 * 主結果 →「他の方式との比較」(展開式の比較表)→ 性質レポート → エクスポートの順に表示する。
 * 「決議ではなく参考情報」の旨の常時表示は呼び出し元ページのディスクレイマーで担保する。
 */
export function VotingResultsPanel({ results }: VotingResultsPanelProps) {
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardDescription>
            {RULE_LABELS[results.primary.rule] ?? results.primary.rule}での結果
          </CardDescription>
          <CardTitle>{winnerLabels(results.primary, results.options)}</CardTitle>
          <CardDescription>投票数: {results.ballot_count}件</CardDescription>
        </CardHeader>
        <CardContent>
          <ExportVotingResultsMenu results={results} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>投票者</CardTitle>
          <CardDescription>
            投票済みのニックネーム一覧です。同一ニックネームでの再投票は上書きされる
            ため、件数は投票数と一致します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results.voters.length === 0 ? (
            <p className="text-sm text-slate-500">投票者はいません。</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {results.voters.map((voter, index) => (
                <li key={`${voter}-${index}`}>
                  <Badge variant="neutral">{voter}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <button
            type="button"
            className="text-left text-sm font-medium text-primary-700"
            onClick={() => setIsComparisonOpen((open) => !open)}
            aria-expanded={isComparisonOpen}
          >
            他の方式との比較 {isComparisonOpen ? "▲" : "▼"}
          </button>
        </CardHeader>
        {isComparisonOpen ? (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>選択肢</TableHead>
                  {results.comparison.map((rule) => (
                    <TableHead key={rule.rule}>
                      {RULE_LABELS[rule.rule] ?? rule.rule}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.options.map((option, index) => (
                  <TableRow key={option}>
                    <TableCell>{option}</TableCell>
                    {results.comparison.map((rule) => (
                      <TableCell key={rule.rule}>
                        {rule.scores[index] ?? "―"}
                        {rule.winners.includes(index) ? (
                          <Badge variant="primary" className="ml-2">
                            勝者
                          </Badge>
                        ) : null}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>性質レポート</CardTitle>
          <CardDescription>
            コンドルセ勝者の有無・多数決の逆理・方式間での勝者の入れ替わり・戦略的操作への耐性の注記です(ホバー・フォーカスで詳細を表示)。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-wrap gap-3">
            {results.report.map((item, index) => {
              const badge = REPORT_BADGE[item.status] ?? REPORT_BADGE.info;
              return (
                <li key={index} className="group relative">
                  <Badge variant={badge?.variant} tabIndex={0}>
                    {badge?.symbol} {item.label}
                  </Badge>
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-xs -translate-x-1/2 rounded-control bg-slate-900 px-3 py-2 text-xs text-white opacity-0 shadow-popover transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    <p>{item.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
