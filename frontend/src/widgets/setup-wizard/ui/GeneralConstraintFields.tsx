import type { ConstraintEntry } from "../../../entities/matching";
import { useCaConstraintMeta } from "../../../features/ca-constraint-meta";
import type { EmployeePair } from "../lib/validation";

import { EmployeePairListField } from "./EmployeePairListField";
import { FieldErrorList } from "./FieldErrorList";

export interface GeneralConstraintFieldsProps {
  constraints: readonly ConstraintEntry[];
  onChangeConstraints: (next: readonly ConstraintEntry[]) => void;
  employeeNames: readonly string[];
  /** サーバー検証（10b）由来のエラー（`constraints` フィールド）。 */
  apiErrors?: readonly string[];
}

function toEmployeePairs(value: unknown): EmployeePair[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (pair): pair is EmployeePair =>
      Array.isArray(pair) &&
      pair.length === 2 &&
      typeof pair[0] === "number" &&
      typeof pair[1] === "number",
  );
}

/**
 * CA（general）固有の詳細フォーム: 追加制約（NG ペア等）の入力。
 *
 * 制約レジストリ（application/constraints.py）が配信するメタ情報
 * （`GET /api/v1/meta/ca-constraint-types`）から動的にフォームを構成する。
 * フィールドの入力方式（field_type）ごとに汎用コンポーネントをディスパッチし、
 * 制約種別（ng_pair 等）ごとの個別実装は持たない。制約レジストリへ新しい制約種別を
 * 追加した場合も、既存の field_type を再利用する限り本コンポーネントの改修は不要。
 */
export function GeneralConstraintFields({
  constraints,
  onChangeConstraints,
  employeeNames,
  apiErrors = [],
}: GeneralConstraintFieldsProps) {
  const { data: metas, isPending, isError } = useCaConstraintMeta();

  function replacePairsField(constraintKey: string, fieldName: string, pairs: EmployeePair[]) {
    const existingIndex = constraints.findIndex((entry) => entry.type === constraintKey);
    if (pairs.length === 0) {
      if (existingIndex === -1) {
        return;
      }
      onChangeConstraints(constraints.filter((_, index) => index !== existingIndex));
      return;
    }

    const nextEntry: ConstraintEntry = {
      type: constraintKey,
      params: { [fieldName]: pairs.map(([a, b]) => [a, b]) },
    };
    if (existingIndex === -1) {
      onChangeConstraints([...constraints, nextEntry]);
    } else {
      onChangeConstraints(
        constraints.map((entry, index) => (index === existingIndex ? nextEntry : entry)),
      );
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">追加制約（任意）</h3>
      <p className="mt-1 text-xs text-slate-500">
        NGペア等の追加制約がある場合のみ入力します（未入力でも実行できます）。
      </p>

      {isPending && <p className="mt-3 text-xs text-slate-500">読み込み中…</p>}
      {isError && (
        <p className="mt-3 text-xs text-danger-600">
          追加制約の入力フォームを取得できませんでした。ページを再読み込みしてください。
        </p>
      )}

      {metas?.map((meta) => {
        const entry = constraints.find((c) => c.type === meta.key);
        return (
          <div key={meta.key} className="mt-4">
            <h4 className="text-sm font-medium text-slate-800">{meta.label}</h4>
            {meta.fields.map((field) => {
              if (field.fieldType === "employee_pair_list") {
                const pairs = toEmployeePairs(entry?.params?.[field.name]);
                return (
                  <EmployeePairListField
                    key={field.name}
                    label={field.label}
                    helpText={field.helpText}
                    employeeNames={employeeNames}
                    pairs={pairs}
                    onAddPair={(pair) =>
                      replacePairsField(meta.key, field.name, [...pairs, pair])
                    }
                    onRemovePair={(index) =>
                      replacePairsField(
                        meta.key,
                        field.name,
                        pairs.filter((_, i) => i !== index),
                      )
                    }
                  />
                );
              }
              // 未対応の field_type（新しい入力方式を追加した際のフォールバック表示）。
              return (
                <p key={field.name} className="mt-2 text-xs text-danger-600">
                  {field.label}: この環境は未対応の入力形式です（field_type: {field.fieldType}）。
                </p>
              );
            })}
          </div>
        );
      })}

      <FieldErrorList messages={apiErrors} />
    </div>
  );
}
