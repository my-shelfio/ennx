import { EMPLOYEE_COUNT_MAX, sumCapacities } from "../lib/validation";

import { FieldErrorList } from "./FieldErrorList";
import { NumberField } from "./NumberField";

export interface CapacitiesFieldsProps {
  departmentNames: readonly string[];
  capacities: readonly (number | null)[];
  onChangeCapacity: (index: number, value: number | null) => void;
  errors: Record<number, string>;
  /** 社員数が定員合計を超えている場合の警告（続行可能）。 */
  showSumWarning: boolean;
  /** サーバー検証（10b）由来のエラー（`capacities` フィールド）。 */
  apiErrors?: readonly string[];
}

/** 部署ごとの定員入力（DA / FDA / CA 共通）。 */
export function CapacitiesFields({
  departmentNames,
  capacities,
  onChangeCapacity,
  errors,
  showSumWarning,
  apiErrors = [],
}: CapacitiesFieldsProps) {
  const totalCapacity = sumCapacities(capacities);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold text-slate-900">部署ごとの定員</h3>
        <p className="text-sm text-slate-600">
          定員合計: <span className="font-semibold text-slate-900">{totalCapacity}</span>
        </p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {capacities.map((value, index) => (
          <NumberField
            // 部署の並び順は変わらないため、安定した参照として index を用いる
            key={index}
            id={`capacity-${index}`}
            label={`${departmentNames[index] ?? `部署${index + 1}`}の定員`}
            value={value}
            onChange={(next) => onChangeCapacity(index, next)}
            min={0}
            max={EMPLOYEE_COUNT_MAX}
            error={errors[index]}
          />
        ))}
      </div>
      {showSumWarning && (
        <p
          role="alert"
          className="mt-3 rounded-control border border-warning-100 bg-warning-50 px-3 py-2 text-xs text-warning-700"
        >
          社員数が定員の合計を超えており、未配属者が生じえます。
        </p>
      )}
      <FieldErrorList messages={apiErrors} />
    </div>
  );
}
