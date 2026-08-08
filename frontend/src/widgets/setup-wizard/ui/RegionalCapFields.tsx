import { DEPARTMENT_COUNT_MAX, EMPLOYEE_COUNT_MAX } from "../lib/validation";

import { FieldErrorList } from "./FieldErrorList";
import { FieldErrorText } from "./FieldErrorText";
import { NumberField } from "./NumberField";

export interface RegionalCapFieldsProps {
  departmentNames: readonly string[];
  maxCaps: readonly (number | null)[];
  onChangeMaxCap: (index: number, value: number | null) => void;
  maxCapErrors: Record<number, string>;
  regionCount: number;
  onChangeRegionCount: (value: number) => void;
  regions: readonly (number | null)[];
  onChangeRegion: (index: number, value: number | null) => void;
  regionErrors: Record<number, string>;
  regionalCaps: readonly (number | null)[];
  onChangeRegionalCap: (index: number, value: number | null) => void;
  regionalCapErrors: Record<number, string>;
  regionalCapacitySumError?: string | undefined;
  /** サーバー検証（10b）由来のエラー（max_caps / regions / regional_caps フィールド）。 */
  apiErrors?: readonly string[];
}

/** FDA（regional_cap）固有の詳細フォーム: 設置上限・地域・地域上限。 */
export function RegionalCapFields({
  departmentNames,
  maxCaps,
  onChangeMaxCap,
  maxCapErrors,
  regionCount,
  onChangeRegionCount,
  regions,
  onChangeRegion,
  regionErrors,
  regionalCaps,
  onChangeRegionalCap,
  regionalCapErrors,
  regionalCapacitySumError,
  apiErrors = [],
}: RegionalCapFieldsProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">部署ごとの設置上限</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {maxCaps.map((value, index) => (
            <NumberField
              key={index}
              id={`max-cap-${index}`}
              label={`${departmentNames[index] ?? `部署${index + 1}`}の設置上限`}
              value={value}
              onChange={(next) => onChangeMaxCap(index, next)}
              min={0}
              max={EMPLOYEE_COUNT_MAX}
              error={maxCapErrors[index]}
            />
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="region-count" className="block text-sm font-medium text-slate-700">
          地域数
        </label>
        <select
          id="region-count"
          value={regionCount}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChangeRegionCount(Number.isNaN(next) || next < 1 ? 1 : Math.trunc(next));
          }}
          className="mt-1 h-10 w-32 rounded-control border border-slate-300 px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          {Array.from({ length: DEPARTMENT_COUNT_MAX }, (_, index) => index + 1).map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">部署ごとの地域</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {regions.map((value, index) => {
            const errorId = `region-${index}-error`;
            return (
              <div key={index}>
                <label
                  htmlFor={`region-${index}`}
                  className="block text-sm font-medium text-slate-700"
                >
                  {`${departmentNames[index] ?? `部署${index + 1}`}の地域`}
                </label>
                <select
                  id={`region-${index}`}
                  value={value ?? ""}
                  onChange={(event) => {
                    const raw = event.target.value;
                    onChangeRegion(index, raw === "" ? null : Number(raw));
                  }}
                  aria-invalid={regionErrors[index] !== undefined}
                  aria-describedby={regionErrors[index] !== undefined ? errorId : undefined}
                  className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  <option value="">選択してください</option>
                  {Array.from({ length: regionCount }, (_, region) => region).map((region) => (
                    <option key={region} value={region}>
                      地域{region + 1}
                    </option>
                  ))}
                </select>
                <FieldErrorText id={errorId} message={regionErrors[index]} />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">地域ごとの受け入れ上限</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {regionalCaps.map((value, index) => (
            <NumberField
              key={index}
              id={`regional-cap-${index}`}
              label={`地域${index + 1}の受け入れ上限`}
              value={value}
              onChange={(next) => onChangeRegionalCap(index, next)}
              min={0}
              max={EMPLOYEE_COUNT_MAX}
              error={regionalCapErrors[index]}
            />
          ))}
        </div>
        <FieldErrorText message={regionalCapacitySumError} />
        <FieldErrorList messages={apiErrors} />
      </div>
    </div>
  );
}
