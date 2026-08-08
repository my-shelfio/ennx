import { useId, useState } from "react";

import { Button } from "../../../shared/ui";
import type { EmployeePair } from "../lib/validation";
import { validateEmployeePairDraft } from "../lib/validation";

import { FieldErrorText } from "./FieldErrorText";

export interface EmployeePairListFieldProps {
  label: string;
  helpText?: string | null;
  employeeNames: readonly string[];
  pairs: readonly EmployeePair[];
  onAddPair: (pair: EmployeePair) => void;
  onRemovePair: (index: number) => void;
}

/**
 * field_type "employee_pair_list" の汎用フィールド: 社員×社員のペアを複数登録する入力。
 * 制約種別（ng_pair 等）に依存しない汎用コンポーネントであり、
 * GeneralConstraintFields から field_type をキーにディスパッチされる。
 */
export function EmployeePairListField({
  label,
  helpText,
  employeeNames,
  pairs,
  onAddPair,
  onRemovePair,
}: EmployeePairListFieldProps) {
  const [firstText, setFirstText] = useState("");
  const [secondText, setSecondText] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const fieldId = useId();
  const hasEnoughEmployees = employeeNames.length >= 2;

  function handleAdd() {
    const firstIndex = firstText === "" ? null : Number(firstText);
    const secondIndex = secondText === "" ? null : Number(secondText);
    const result = validateEmployeePairDraft(pairs, firstIndex, secondIndex);
    if (result.error !== undefined) {
      setError(result.error);
      return;
    }
    if (result.pair !== undefined) {
      onAddPair(result.pair);
    }
    setFirstText("");
    setSecondText("");
    setError(undefined);
  }

  return (
    <div className="mt-2 rounded-control border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {helpText !== null && helpText !== undefined && (
        <p className="mt-1 text-xs text-slate-500">{helpText}</p>
      )}

      {pairs.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {pairs.map(([a, b], index) => (
            <li
              key={`${a}-${b}`}
              className="flex items-center justify-between rounded-control border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <span>
                {employeeNames[a] ?? `社員${a + 1}`} × {employeeNames[b] ?? `社員${b + 1}`}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => onRemovePair(index)}>
                削除
              </Button>
            </li>
          ))}
        </ul>
      )}

      {hasEnoughEmployees ? (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor={`${fieldId}-first`}
              className="block text-xs font-medium text-slate-600"
            >
              社員1
            </label>
            <select
              id={`${fieldId}-first`}
              value={firstText}
              onChange={(event) => setFirstText(event.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <option value="">選択してください</option>
              {employeeNames.map((name, index) => (
                <option key={index} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label
              htmlFor={`${fieldId}-second`}
              className="block text-xs font-medium text-slate-600"
            >
              社員2
            </label>
            <select
              id={`${fieldId}-second`}
              value={secondText}
              onChange={(event) => setSecondText(event.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <option value="">選択してください</option>
              {employeeNames.map((name, index) => (
                <option key={index} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" variant="outline" onClick={handleAdd}>
            追加
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          社員が2名以上いる場合に組み合わせを追加できます。
        </p>
      )}
      <FieldErrorText message={error} />
    </div>
  );
}
