import { useMemo } from "react";

import type { JourneyPrefs, MatchingResult } from "../../../entities/matching";
import { buildEmployeeJourney } from "../../../entities/matching";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "../../../shared/ui";

import { buildJourneySummary, describeJourneyStep } from "../lib/summary";

export interface EmployeeExplanationProps {
  result: MatchingResult;
  /** 実行に使った選好（社員→部署・部署→社員、1-indexed）。 */
  prefs: JourneyPrefs;
  /** 説明する社員（0-indexed）。null のときは選択を促す案内を表示する。 */
  employeeIndex: number | null;
  /** 「この社員の過程をステップ再生で見る」押下時のハンドラ。 */
  onReplay?: (employeeIndex: number) => void;
}

/**
 * 社員ごとの「なぜこの配属か」説明パネル。
 * イベントログから当該社員の経緯を組み立て、結論・上位希望が通らなかった理由の要約と、
 * 展開式の時系列（全ステップ）を表示する。
 */
export function EmployeeExplanation({
  result,
  prefs,
  employeeIndex,
  onReplay,
}: EmployeeExplanationProps) {
  const journey = useMemo(
    () => (employeeIndex === null ? null : buildEmployeeJourney(result, prefs, employeeIndex)),
    [result, prefs, employeeIndex],
  );

  if (journey === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">なぜこの配属か</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            詳細テーブルで社員を選ぶと、その社員の配属の経緯（希望した部署・受け入れられなかった理由・確定先）を表示します。
          </p>
        </CardContent>
      </Card>
    );
  }

  const summary = buildJourneySummary(journey, result.employee_names, result.department_names);
  const employeeName = result.employee_names[journey.employee] ?? `社員${journey.employee + 1}`;

  return (
    <Card aria-live="polite">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{employeeName}の配属の経緯</CardTitle>
          {journey.finalDepartment === -1 ? (
            <Badge variant="warning">未配属</Badge>
          ) : (
            journey.finalRank !== null && <Badge>第{journey.finalRank}希望</Badge>
          )}
        </div>
        <p className="text-sm font-medium text-slate-900">{summary.headline}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {summary.reasons.length > 0 && (
          <ul className="flex flex-col gap-2 text-sm text-slate-600">
            {summary.reasons.map((reason) => (
              <li key={reason} className="rounded-control bg-slate-50 px-3 py-2">
                {reason}
              </li>
            ))}
          </ul>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-primary-700">
            経緯をすべて表示（{journey.steps.length} ステップ）
          </summary>
          <ol className="mt-3 flex flex-col gap-2 border-l border-slate-200 pl-4">
            {journey.steps.map((step) => {
              const { label, detail } = describeJourneyStep(
                step,
                result.department_names,
                result.algorithm,
              );
              return (
                <li key={`${step.kind}-${step.stepIndex}`} className="flex flex-col gap-0.5">
                  <span className="text-xs text-slate-400">
                    ラウンド {step.round}・{label}
                  </span>
                  <span className="text-slate-700">{detail}</span>
                </li>
              );
            })}
          </ol>
        </details>

        {onReplay !== undefined && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start print:hidden"
            onClick={() => onReplay(journey.employee)}
          >
            この社員の過程をステップ再生で見る
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
