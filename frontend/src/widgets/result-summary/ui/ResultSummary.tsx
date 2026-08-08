import type { MatchingResult } from "../../../entities/matching";
import { normalizeBlockingPairs } from "../../../entities/matching";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/ui";
import { computeSummaryMetrics, findStabilityReportItem } from "../lib/metrics";

export interface ResultSummaryProps {
  result: MatchingResult;
  /** 実行に使った選好リスト（社員→部署、1-indexed）。第1希望配属率の算出に使う。 */
  proposerPrefs: readonly (readonly number[])[];
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

const REPORT_BADGE: Record<string, { symbol: string; variant: "ok" | "danger" | "neutral" }> = {
  ok: { symbol: "✓", variant: "ok" },
  ng: { symbol: "✗", variant: "danger" },
  info: { symbol: "―", variant: "neutral" },
};

/**
 * 結果画面のサマリーカード + 性質レポートバッジ。
 * 5枚のサマリーカード（マッチ数/全社員・定員合計・充足率・第1希望配属率・安定性判定）と、
 * 性質レポート全項目のバッジ一覧（✓/✗/― + ツールチップ）を表示する。
 */
function formatRank(rank: number | null): string {
  return rank === null ? "―" : `${rank.toFixed(1)}位`;
}

export function ResultSummary({ result, proposerPrefs }: ResultSummaryProps) {
  const metrics = computeSummaryMetrics(result, proposerPrefs);
  const stabilityItem = findStabilityReportItem(result.report);
  const blockingPairItems = result.report
    .map((item) => ({ label: item.label, pairs: normalizeBlockingPairs(item.blocking_pairs) }))
    .filter((item) => item.pairs.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>マッチ数 / 全社員</CardDescription>
            <CardTitle>
              {metrics.matchedCount} / {metrics.totalEmployees}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>定員合計</CardDescription>
            <CardTitle>{metrics.totalCapacity}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>充足率</CardDescription>
            <CardTitle>{formatPercent(metrics.capacityFillRate)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>第1希望配属率</CardDescription>
            <CardTitle>{formatPercent(metrics.firstChoiceRate)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>平均希望順位（配属者）</CardDescription>
            <CardTitle>{formatRank(metrics.averageAssignedRank)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>未配属数</CardDescription>
            <CardTitle>{metrics.unmatchedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{stabilityItem?.label ?? "安定性判定"}</CardDescription>
            <CardTitle>
              {stabilityItem === undefined ? (
                "―"
              ) : (
                <Badge variant={REPORT_BADGE[stabilityItem.status]?.variant ?? "neutral"}>
                  {REPORT_BADGE[stabilityItem.status]?.symbol ?? "―"}{" "}
                  {stabilityItem.status === "ok" ? "満たしている" : "違反あり"}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {metrics.rankDistribution.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>希望順位の分布</CardTitle>
            <CardDescription>
              配属者が第何希望の部署に配属されたかの内訳です（未配属者は含みません）。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-3">
              {metrics.rankDistribution.map((count, index) => (
                <li
                  key={index}
                  className="rounded-control bg-slate-50 px-3 py-2 text-sm text-slate-700"
                >
                  第{index + 1}希望: {count}人
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>性質レポート</CardTitle>
          <CardDescription>
            実行結果が満たす理論的性質の一覧です。各項目は入力データに対してアルゴリズムが保証する範囲を示すもので、入力データ自体の正確性・網羅性は保証しません（ホバー・フォーカスで詳細を表示）。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-wrap gap-3">
            {result.report.map((item, index) => {
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
                    <p className="mt-1 border-t border-slate-700 pt-1 text-slate-300">
                      入力データに対してアルゴリズムが保証する性質です。入力データ自体の正確性・網羅性は保証しません。
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {blockingPairItems.length > 0 ? (
        <Card className="border-danger-100 bg-danger-50">
          <CardHeader>
            <CardTitle>ブロッキングペアの一覧</CardTitle>
            <CardDescription>
              安定性・弱安定性の違反の原因となった社員↔部署の組です。社員は組み手側の部署を現在の配属より好み、部署側も受け入れ可能であることを示します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {blockingPairItems.map((item) => (
                <li key={item.label}>
                  <p className="mb-1 text-sm font-medium text-slate-700">{item.label}</p>
                  <ul className="flex flex-wrap gap-2">
                    {item.pairs.map(([employeeIndex, departmentIndex], pairIndex) => {
                      const employeeName =
                        result.employee_names[employeeIndex] ?? `社員${employeeIndex + 1}`;
                      const departmentName =
                        result.department_names[departmentIndex] ?? `部署${departmentIndex + 1}`;
                      return (
                        <li
                          key={pairIndex}
                          className="rounded-pill border border-danger-100 bg-white px-3 py-1 text-sm text-danger-700"
                        >
                          {employeeName} ↔ {departmentName}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
