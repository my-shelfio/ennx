import { useState } from "react";

import type { AssignmentResult } from "../../../entities/assignment";
import { UNASSIGNED } from "../../../entities/assignment";
import { Badge, Button } from "../../../shared/ui";

interface DrawnAssignmentProps {
  result: AssignmentResult;
  /** 新しいシードで引き直す。省略すると引き直しの操作を出さない。 */
  onRedraw?: (() => void) | undefined;
  /** シードを指定して同じ配属を再現する。省略すると再現の操作を出さない。 */
  onReproduce?: ((seed: number) => void) | undefined;
}

/**
 * 抽選 1 回分の配属。
 *
 * 期待割当（確率）は「配れる形」ではないため、くじを 1 回引いた結果を配属案として示す。
 * 同じ入力と同じシードなら誰が再実行しても同じ結果になるので、抽選が恣意的でないことを
 * 後から確認できる。
 *
 * ただしシードは「気に入る結果が出るまで引き直す」ことを防ぐ仕組みではない。
 * 防ぐには抽選前にシードを公表するなどの運用が要るため、その区別が伝わる文言を添える。
 */
export function DrawnAssignment({ result, onRedraw, onReproduce }: DrawnAssignmentProps) {
  // 入力欄の初期値は今回のシード。新しい結果が来たら呼び出し側が key を変えて
  // 作り直すため、ここで結果に追従させる必要はない。
  const [seedInput, setSeedInput] = useState(String(result.seed));

  const parsedSeed = Number(seedInput);
  const canReproduce =
    seedInput.trim() !== "" && Number.isInteger(parsedSeed) && parsedSeed >= 0;

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-2 sm:grid-cols-2">
        {result.employee_names.map((name, employee) => {
          const department = result.drawn_assignment[employee] ?? UNASSIGNED;
          return (
            <li
              key={name}
              className="flex items-center justify-between rounded-control border border-slate-200 px-3 py-2 text-sm"
            >
              <span className="text-slate-700">{name}</span>
              <span
                className={
                  department === UNASSIGNED ? "text-slate-400" : "font-medium text-slate-900"
                }
              >
                {department === UNASSIGNED
                  ? "未配属"
                  : (result.department_names[department] ?? `部署${department + 1}`)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 rounded-control bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">シード {result.seed}</Badge>
          {onReproduce && (
            <>
              <label className="text-xs text-slate-600" htmlFor="assignment-seed">
                シードを指定して再現
              </label>
              <input
                id="assignment-seed"
                type="number"
                min={0}
                value={seedInput}
                onChange={(event) => setSeedInput(event.target.value)}
                className="w-40 rounded-control border border-slate-300 px-2 py-1 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canReproduce}
                onClick={() => onReproduce(parsedSeed)}
              >
                このシードで実行
              </Button>
            </>
          )}
          {onRedraw && (
            <Button type="button" variant="ghost" size="sm" onClick={onRedraw}>
              引き直す
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          同じ希望順位・同じシードで実行すれば、この配属をいつでも再現できます。
          ただしシードは「引き直して結果を選ぶ」ことを防ぐものではありません。恣意的な
          選択を避けるには、抽選前にシードを関係者へ知らせるなどの運用を組み合わせてください。
        </p>
      </div>
    </div>
  );
}
