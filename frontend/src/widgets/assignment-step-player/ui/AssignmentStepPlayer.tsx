import { useState } from "react";

import { buildTimeline } from "../../../entities/assignment";
import type { AssignmentResult } from "../../../entities/assignment";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../shared/ui";

import { consumedLabel, stepHeading } from "../lib/describe";

interface AssignmentStepPlayerProps {
  result: AssignmentResult;
}

/**
 * イーティング過程のステップ再生。
 *
 * PS は「全員が同時に、いま獲得できる中で最も希望の高い部署を少しずつ食べる」過程で
 * 進む。1 ステップ = 1 つの時刻区間で、その区間に誰が何を食べていたか、区間の終わりに
 * 何が起きて（受け入れ人数の枯渇・制約の飽和）状況が変わったかを示す。
 */
export function AssignmentStepPlayer({ result }: AssignmentStepPlayerProps) {
  const timeline = buildTimeline(result.events, result.employee_names.length);
  const [index, setIndex] = useState(0);
  const current = timeline[Math.min(index, timeline.length - 1)];

  if (!current) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>実行過程（{timeline.length} ステップ）</CardTitle>
        <CardDescription>
          全員が同時に、いま獲得できる中で最も希望の高い部署を少しずつ取り合います。
          区切りは「受け入れ人数が尽きた瞬間」と「追加制約が上限に達した瞬間」です。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            disabled={index === 0}
          >
            前へ
          </Button>
          <span className="text-sm font-medium text-slate-700">{stepHeading(current)}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIndex((value) => Math.min(timeline.length - 1, value + 1))}
            disabled={index >= timeline.length - 1}
          >
            次へ
          </Button>
          <Badge variant="neutral">この区間で {current.amount} ずつ消費</Badge>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {result.employee_names.map((name, employee) => (
            <li
              key={name}
              className="flex items-center justify-between rounded-control border border-slate-200 px-3 py-2 text-sm"
            >
              <span className="text-slate-700">{name}</span>
              <span className="text-slate-500">
                {consumedLabel(current, employee, result.department_names)}
              </span>
            </li>
          ))}
        </ul>

        {current.notes.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-slate-600">
            {current.notes.map((note) => (
              <li key={note}>・{note}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
