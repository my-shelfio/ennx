import type { ConstraintEntry } from "../../../entities/matching";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../shared/ui";
import type { ConstraintTypeKey } from "../lib/constraintTypes";

import { CapacitiesFields } from "./CapacitiesFields";
import { FieldErrorList } from "./FieldErrorList";
import { GeneralConstraintFields } from "./GeneralConstraintFields";
import { RegionalCapFields } from "./RegionalCapFields";

export interface DetailStepProps {
  constraintType: ConstraintTypeKey;
  departmentNames: readonly string[];

  capacities: readonly (number | null)[];
  onChangeCapacity: (index: number, value: number | null) => void;
  capacityErrors: Record<number, string>;
  showCapacitySumWarning: boolean;
  /** サーバー検証（10b）由来のエラー（`capacities` フィールド）。 */
  capacitiesApiErrors: readonly string[];

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
  regionalCapApiErrors: readonly string[];

  constraints: readonly ConstraintEntry[];
  onChangeConstraints: (next: readonly ConstraintEntry[]) => void;
  employeeNames: readonly string[];
  /** サーバー検証（10b）由来のエラー（`constraints` フィールド）。 */
  constraintsApiErrors: readonly string[];

  /** サーバー検証（10b）から返ったフィールド未特定のエラー、または実行不可のエラー。 */
  generalErrors: readonly string[];
  isSubmitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

/** ウィザード ステップ3（詳細: 定員・制約種別ごとのフォーム）。 */
export function DetailStep({
  constraintType,
  departmentNames,
  capacities,
  onChangeCapacity,
  capacityErrors,
  showCapacitySumWarning,
  capacitiesApiErrors,
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
  regionalCapApiErrors,
  constraints,
  onChangeConstraints,
  employeeNames,
  constraintsApiErrors,
  generalErrors,
  isSubmitting,
  onBack,
  onSubmit,
}: DetailStepProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <Card>
        <CardHeader>
          <CardTitle>定員・制約の詳細を入力してください</CardTitle>
          <CardDescription>選択した制約種別に応じた項目を入力します。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <CapacitiesFields
            departmentNames={departmentNames}
            capacities={capacities}
            onChangeCapacity={onChangeCapacity}
            errors={capacityErrors}
            showSumWarning={showCapacitySumWarning}
            apiErrors={capacitiesApiErrors}
          />

          {constraintType === "regional_cap" && (
            <RegionalCapFields
              departmentNames={departmentNames}
              maxCaps={maxCaps}
              onChangeMaxCap={onChangeMaxCap}
              maxCapErrors={maxCapErrors}
              regionCount={regionCount}
              onChangeRegionCount={onChangeRegionCount}
              regions={regions}
              onChangeRegion={onChangeRegion}
              regionErrors={regionErrors}
              regionalCaps={regionalCaps}
              onChangeRegionalCap={onChangeRegionalCap}
              regionalCapErrors={regionalCapErrors}
              regionalCapacitySumError={regionalCapacitySumError}
              apiErrors={regionalCapApiErrors}
            />
          )}

          {constraintType === "general" && (
            <GeneralConstraintFields
              constraints={constraints}
              onChangeConstraints={onChangeConstraints}
              employeeNames={employeeNames}
              apiErrors={constraintsApiErrors}
            />
          )}

          {generalErrors.length > 0 && (
            <div className="rounded-control border border-danger-100 bg-danger-50 px-3 py-2 text-xs text-danger-700">
              <FieldErrorList messages={generalErrors} />
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-between">
          <Button type="button" variant="outline" onClick={onBack}>
            戻る
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "検証中…" : "次へ"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
