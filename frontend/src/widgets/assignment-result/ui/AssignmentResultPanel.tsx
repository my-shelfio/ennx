import type { AssignmentResult } from "../../../entities/assignment";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../shared/ui";

import { expectedHeadcounts, expectedUnassigned } from "../lib/summary";

import { AssignmentReport } from "./AssignmentReport";
import { ExpectedAssignmentTable } from "./ExpectedAssignmentTable";
import { LotteryList } from "./LotteryList";

interface AssignmentResultPanelProps {
  result: AssignmentResult;
}

/**
 * 割り当ての結果画面。
 *
 * 「期待割当（どのくらいの確率で配属されるか）→ くじ（実際にどう配るか）→
 * 性質レポート（この結果が何を保証するか）」の順に並べ、説明に使える形にする。
 */
export function AssignmentResultPanel({ result }: AssignmentResultPanelProps) {
  const headcounts = expectedHeadcounts(result);
  const unassigned = expectedUnassigned(result);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>期待割当</CardTitle>
          <CardDescription>
            各社員が各部署に配属される確率です。行の合計は必ず 1 になります。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ExpectedAssignmentTable result={result} />
          <p className="text-sm text-slate-600">
            配属人数の期待値:{" "}
            {result.department_names
              .map((name, index) => `${name} ${(headcounts[index] ?? 0).toFixed(2)}人`)
              .join("、")}
            {unassigned > 0 && `、未配属 ${unassigned.toFixed(2)}人`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>確定的な配属のくじ（{result.lottery.length} 通り）</CardTitle>
          <CardDescription>
            期待割当は分数のままでは配れません。制約を満たす確定的な配属と、それを引く確率に
            分解したものがこの一覧です。抽選は利用者が行ってください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LotteryList result={result} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>性質レポート</CardTitle>
          <CardDescription>この結果が保証すること・保証しないことです。</CardDescription>
        </CardHeader>
        <CardContent>
          <AssignmentReport report={result.report} />
        </CardContent>
      </Card>
    </div>
  );
}
