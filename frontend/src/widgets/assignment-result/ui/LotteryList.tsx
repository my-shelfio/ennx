import { fractionToPercent } from "../../../entities/assignment";
import type { AssignmentResult } from "../../../entities/assignment";
import { Badge } from "../../../shared/ui";

import { describeTerm } from "../lib/summary";

interface LotteryListProps {
  result: AssignmentResult;
}

/**
 * 確定的な配属のくじ。
 *
 * 期待割当は分数のままでは配れないため、「この配属をこの確率で引く」という形に
 * 分解した結果を一覧で示す。どの項を引いても受け入れ人数と追加制約を満たす。
 * 抽選そのものは行わない（ennx は意思決定を代行しない）。
 */
export function LotteryList({ result }: LotteryListProps) {
  return (
    <ol className="flex flex-col gap-3">
      {result.lottery.map((term, index) => (
        <li
          key={index}
          className="rounded-card border border-slate-200 p-4"
        >
          <div className="flex items-center gap-2">
            <Badge variant="primary">確率 {term.weight}</Badge>
            <span className="text-xs text-slate-500">（約 {fractionToPercent(term.weight)}）</span>
          </div>
          <p className="mt-2 text-sm text-slate-700">{describeTerm(term, result)}</p>
        </li>
      ))}
    </ol>
  );
}
