import { useMemo } from "react";

import type { FollowUpThreshold, JourneyPrefs, MatchingResult } from "../../../entities/matching";
import {
  extractFollowUpEmployees,
  FOLLOW_UP_THRESHOLDS,
  rejectionCauseLabel,
} from "../../../entities/matching";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/ui";

export interface FollowUpListProps {
  result: MatchingResult;
  /** 実行に使った選好（社員→部署・部署→社員、1-indexed）。 */
  prefs: JourneyPrefs;
  /** 第 N 希望以下を対象にするしきい値。 */
  threshold: FollowUpThreshold;
  onThresholdChange: (threshold: FollowUpThreshold) => void;
  /** 社員名を選んだときのハンドラ（説明パネルの表示などに使う）。 */
  onSelectEmployee?: (employeeIndex: number) => void;
}

/**
 * 「フォロー推奨」一覧。第 N 希望以下に配属された社員と未配属の社員を、希望と結果、
 * 第 1〜2 希望が通らなかった理由つきで並べる（結果通達後の個別フォロー用）。
 */
export function FollowUpList({
  result,
  prefs,
  threshold,
  onThresholdChange,
  onSelectEmployee,
}: FollowUpListProps) {
  const employees = useMemo(
    () => extractFollowUpEmployees(result, prefs, threshold),
    [result, prefs, threshold],
  );

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <CardTitle>フォロー推奨（{employees.length}名）</CardTitle>
          <CardDescription>
            第{threshold}希望以下に配属された社員と未配属の社員です。希望から遠い順に並びます。
          </CardDescription>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
          対象
          <select
            value={threshold}
            onChange={(event) =>
              onThresholdChange(Number(event.target.value) as FollowUpThreshold)
            }
            className="h-9 rounded-control border border-slate-300 bg-white px-2 text-sm text-slate-900"
          >
            {FOLLOW_UP_THRESHOLDS.map((value) => (
              <option key={value} value={value}>
                第{value}希望以下
              </option>
            ))}
          </select>
        </label>
      </CardHeader>
      <CardContent>
        {employees.length === 0 ? (
          <p className="text-sm text-slate-500">
            第{threshold}希望以下の配属・未配属の社員はいません。
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {employees.map((employee) => (
              <li
                key={employee.employeeIndex}
                className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {onSelectEmployee === undefined ? (
                    <span className="font-medium text-slate-900">{employee.employeeName}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectEmployee(employee.employeeIndex)}
                      className="font-medium text-primary-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                      {employee.employeeName}
                    </button>
                  )}
                  {employee.departmentName === null ? (
                    <Badge variant="warning">未配属</Badge>
                  ) : (
                    <span className="text-sm text-slate-600">
                      {employee.departmentName}
                      {employee.rank === null ? "（希望外）" : `（第${employee.rank}希望）`}
                    </span>
                  )}
                </div>
                <ul className="flex flex-wrap gap-1.5 text-xs text-slate-500">
                  {employee.topChoices.map((choice) => (
                    <li key={choice.department} className="rounded-pill bg-slate-100 px-2 py-0.5">
                      第{choice.rank}希望 {choice.departmentName}:{" "}
                      {choice.cause === null ? "不成立" : rejectionCauseLabel(choice.cause)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
