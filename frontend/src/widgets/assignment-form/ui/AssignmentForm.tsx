import { useMemo } from "react";

import type { AssignmentInput } from "../../../entities/assignment";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../shared/ui";
import { withDepartmentCount, withEmployeeCount } from "../lib/resize";
import {
  DEPARTMENT_COUNT_MAX,
  EMPLOYEE_COUNT_MAX,
  validateAssignmentInput,
} from "../lib/validation";

import { NgPairField } from "./NgPairField";
import { PreferenceRow } from "./PreferenceRow";

interface AssignmentFormProps {
  input: AssignmentInput;
  onChange: (input: AssignmentInput) => void;
  onSubmit: () => void;
  onLoadSample: () => void;
  submitting: boolean;
}

function labels(names: readonly string[] | null | undefined, count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => names?.[index] || `${prefix}${index + 1}`);
}

/**
 * 割り当ての設定・希望順位入力フォーム。
 *
 * 配属マッチングの設定ウィザードと違い、部署の側の順位づけは求めない
 * （PS は片側選好のメカニズムであるため）。1 画面で規模・受け入れ人数・
 * 希望順位・追加制約まで入力できるようにしている。
 */
export function AssignmentForm({
  input,
  onChange,
  onSubmit,
  onLoadSample,
  submitting,
}: AssignmentFormProps) {
  const employeeLabels = labels(input.employee_names, input.agent_prefs.length, "社員");
  const departmentLabels = labels(input.department_names, input.capacities.length, "部署");
  const errors = useMemo(() => validateAssignmentInput(input), [input]);

  const ngPairs = useMemo(() => {
    const entry = input.constraints?.find((constraint) => constraint.type === "ng_pair");
    const pairs = entry?.params?.pairs;
    return Array.isArray(pairs) ? (pairs as number[][]) : [];
  }, [input.constraints]);

  const setNgPairs = (pairs: number[][]) => {
    onChange({
      ...input,
      constraint_type: pairs.length > 0 ? "general" : "capacity_only",
      constraints: pairs.length > 0 ? [{ type: "ng_pair", params: { pairs } }] : null,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. 規模と受け入れ人数</CardTitle>
          <CardDescription>
            部署ごとに「何人受け入れるか」を決めます。部署の側で候補者に順位をつける必要はありません。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              社員数
              <input
                type="number"
                min={1}
                max={EMPLOYEE_COUNT_MAX}
                value={input.agent_prefs.length}
                onChange={(event) =>
                  onChange(withEmployeeCount(input, Math.max(1, Number(event.target.value))))
                }
                className="w-28 rounded-control border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              部署数
              <input
                type="number"
                min={1}
                max={DEPARTMENT_COUNT_MAX}
                value={input.capacities.length}
                onChange={(event) =>
                  onChange(withDepartmentCount(input, Math.max(1, Number(event.target.value))))
                }
                className="w-28 rounded-control border border-slate-300 px-2 py-1"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-4">
            {input.capacities.map((capacity, index) => (
              <label key={index} className="flex flex-col gap-1 text-sm text-slate-700">
                {departmentLabels[index] ?? `部署${index + 1}`} の受け入れ人数
                <input
                  type="number"
                  min={0}
                  value={capacity}
                  onChange={(event) => {
                    const capacities = [...input.capacities];
                    capacities[index] = Math.max(0, Number(event.target.value));
                    onChange({ ...input, capacities });
                  }}
                  className="w-28 rounded-control border border-slate-300 px-2 py-1"
                />
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. 社員の希望順位</CardTitle>
          <CardDescription>
            希望する部署だけを上位から選びます。選ばなかった部署には配属されません。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                    社員
                  </th>
                  {departmentLabels.map((_, rank) => (
                    <th
                      key={rank}
                      className="px-3 py-2 text-left text-xs font-semibold text-slate-500"
                    >
                      第{rank + 1}希望
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {input.agent_prefs.map((prefs, index) => (
                  <PreferenceRow
                    key={index}
                    employeeLabel={employeeLabels[index] ?? `社員${index + 1}`}
                    departmentLabels={departmentLabels}
                    prefs={prefs}
                    onChange={(next) => {
                      const agentPrefs = input.agent_prefs.map((row, i) =>
                        i === index ? next : row,
                      );
                      onChange({ ...input, agent_prefs: agentPrefs });
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. 追加の制約（任意）</CardTitle>
          <CardDescription>
            同じ部署に配属したくない社員の組を登録できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NgPairField
            employeeLabels={employeeLabels}
            pairs={ngPairs}
            onChange={setNgPairs}
          />
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <ul className="rounded-card border border-warning-100 bg-warning-100/40 p-4 text-sm text-warning-700">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={onSubmit} disabled={submitting || errors.length > 0}>
          {submitting ? "実行中…" : "割り当てを実行する"}
        </Button>
        <Button type="button" variant="outline" onClick={onLoadSample} disabled={submitting}>
          サンプルを読み込む
        </Button>
      </div>
    </div>
  );
}
