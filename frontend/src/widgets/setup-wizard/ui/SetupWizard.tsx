import { useState } from "react";

import type { ConstraintEntry, MatchingInput } from "../../../entities/matching";
import { resolveNames, useMatchingInputStore } from "../../../entities/matching";
import { groupFieldErrors, useValidateInput } from "../../../features/validate-input";
import type { FieldError } from "../../../shared/api";
import { ApiError } from "../../../shared/api";
import { Stepper, useToast } from "../../../shared/ui";
import { resizeArray } from "../lib/arrays";
import { isConstraintTypeKey } from "../lib/constraintTypes";
import type { ConstraintTypeKey } from "../lib/constraintTypes";
import { findDuplicateNameIndexes, normalizeNamesForSubmit } from "../lib/names";
import { computeInitialRegionCount } from "../lib/regionalCap";
import { isEmptyMatchingInput, resolveResumeStep, WIZARD_STEPS } from "../lib/resume";
import type { WizardStepId } from "../lib/resume";
import {
  isCapacitySumBelowEmployeeCount,
  validateCapacities,
  validateMaxCaps,
  validateRegionalCapacitySums,
  validateRegionalCaps,
  validateRegions,
  validateScaleStep,
} from "../lib/validation";
import type { ScaleStepErrors } from "../lib/validation";

import { CompletedPanel } from "./CompletedPanel";
import { ConstraintStep } from "./ConstraintStep";
import { DetailStep } from "./DetailStep";
import { NamesStep } from "./NamesStep";
import { ResumePrompt } from "./ResumePrompt";
import { ScaleStep } from "./ScaleStep";

/** ウィザードの表示フェーズ。"completed" は詳細ステップの検証成功後の確認画面。 */
type WizardPhase = WizardStepId | "completed";

export interface SetupWizardProps {
  /** サンプルデータ起点（?sample=1）の場合、前回入力の再開確認は出さない。 */
  isSample?: boolean;
}

/**
 * 設定ウィザード（規模・制約種別・詳細のステップ入力）。
 * ステップの進捗表示は共通 Stepper、ステップ間検証は features/validate-input を使う。
 */
export function SetupWizard({ isSample = false }: SetupWizardProps) {
  const input = useMatchingInputStore((state) => state.input);
  const setStoreInput = useMatchingInputStore((state) => state.setInput);
  const clearStoreInput = useMatchingInputStore((state) => state.clear);
  const { toast } = useToast();
  const validateMutation = useValidateInput();

  // 前回の入力途中データが残っている場合、再開/破棄の選択を先に表示する（代替フロー 1b）。
  const [needsResumeDecision] = useState(() => !isSample && !isEmptyMatchingInput(input));
  const [resumeDecided, setResumeDecided] = useState(!needsResumeDecision);

  const [phase, setPhase] = useState<WizardPhase>(() =>
    needsResumeDecision ? resolveResumeStep(input) : "scale",
  );

  // ステップ1（規模）。
  const [departmentCount, setDepartmentCount] = useState<number | null>(() =>
    input.capacities.length > 0 ? input.capacities.length : null,
  );
  const [employeeCount, setEmployeeCount] = useState<number | null>(() =>
    input.proposer_prefs.length > 0 ? input.proposer_prefs.length : null,
  );
  const [scaleErrors, setScaleErrors] = useState<ScaleStepErrors>({});

  // ステップ2（制約種別）。
  const [constraintType, setConstraintType] = useState<ConstraintTypeKey | "">(() =>
    isConstraintTypeKey(input.constraint_type) ? input.constraint_type : "",
  );
  const [constraintError, setConstraintError] = useState<string | undefined>(undefined);

  // ステップ「名前」（社員名・部署名、任意）。未入力は空文字のまま保持し、
  // 表示上のデフォルト名（部署N・社員N）は resolveNames にフォールバックを委ねる
  // （フィールドへ "部署1" 等を事前入力すると、ユーザー入力と区別できなくなるため）。
  const [departmentNames, setDepartmentNames] = useState<string[]>(() =>
    resizeArray(input.department_names ?? [], input.capacities.length, ""),
  );
  const [employeeNames, setEmployeeNames] = useState<string[]>(() =>
    resizeArray(input.employee_names ?? [], input.proposer_prefs.length, ""),
  );

  // ステップ3（詳細）。定員は 0 を「未入力」の代替値として扱う（規模ステップで確保する
  // プレースホルダー配列との整合のため。実運用上、定員 0 の部署は稀なケースとして許容する）。
  const [capacities, setCapacities] = useState<(number | null)[]>(() =>
    input.capacities.map((value) => (value > 0 ? value : null)),
  );
  const [capacityErrors, setCapacityErrors] = useState<Record<number, string>>({});
  const [capacitiesApiErrors, setCapacitiesApiErrors] = useState<string[]>([]);

  const [maxCaps, setMaxCaps] = useState<(number | null)[]>(() =>
    resizeArray((input.max_caps ?? []).map((value) => value), input.capacities.length, null),
  );
  const [maxCapErrors, setMaxCapErrors] = useState<Record<number, string>>({});

  const [regionCount, setRegionCount] = useState<number>(() =>
    computeInitialRegionCount(input.regions, input.regional_caps),
  );
  const [regions, setRegions] = useState<(number | null)[]>(() =>
    resizeArray((input.regions ?? []).map((value) => value), input.capacities.length, null),
  );
  const [regionErrors, setRegionErrors] = useState<Record<number, string>>({});

  const [regionalCaps, setRegionalCaps] = useState<(number | null)[]>(() =>
    resizeArray(
      (input.regional_caps ?? []).map((value) => value),
      computeInitialRegionCount(input.regions, input.regional_caps),
      null,
    ),
  );
  const [regionalCapErrors, setRegionalCapErrors] = useState<Record<number, string>>({});
  const [regionalCapacitySumError, setRegionalCapacitySumError] = useState<string | undefined>(
    undefined,
  );
  const [regionalCapApiErrors, setRegionalCapApiErrors] = useState<string[]>([]);

  const [constraints, setConstraints] = useState<ConstraintEntry[]>(() => input.constraints ?? []);
  const [constraintsApiErrors, setConstraintsApiErrors] = useState<string[]>([]);

  const [generalErrors, setGeneralErrors] = useState<string[]>([]);

  function handleResume() {
    setResumeDecided(true);
  }

  const duplicateDepartmentIndexes = findDuplicateNameIndexes(departmentNames);
  const duplicateEmployeeIndexes = findDuplicateNameIndexes(employeeNames);

  function handleNamesNext() {
    // 重複は続行可能な警告のため送信を止めない。空欄は resolveNames のデフォルト名へ
    // フォールバックするため、全欄が未入力ならフィールド自体を省略する（null）。
    setStoreInput({
      department_names: normalizeNamesForSubmit(departmentNames),
      employee_names: normalizeNamesForSubmit(employeeNames),
    });
    setPhase("detail");
  }

  function handleDiscard() {
    clearStoreInput();
    setDepartmentCount(null);
    setEmployeeCount(null);
    setScaleErrors({});
    setConstraintType("");
    setConstraintError(undefined);
    setDepartmentNames([]);
    setEmployeeNames([]);
    setCapacities([]);
    setCapacityErrors({});
    setCapacitiesApiErrors([]);
    setMaxCaps([]);
    setMaxCapErrors({});
    setRegionCount(1);
    setRegions([]);
    setRegionErrors({});
    setRegionalCaps([]);
    setRegionalCapErrors({});
    setRegionalCapacitySumError(undefined);
    setRegionalCapApiErrors([]);
    setConstraints([]);
    setConstraintsApiErrors([]);
    setGeneralErrors([]);
    setPhase("scale");
    setResumeDecided(true);
  }

  function handleScaleNext() {
    const errors = validateScaleStep(departmentCount, employeeCount);
    setScaleErrors(errors);
    if (errors.departmentCount !== undefined || errors.employeeCount !== undefined) {
      return;
    }
    if (departmentCount === null || employeeCount === null) {
      // validateScaleStep が null を弾いているため実際には到達しない（型ガード）。
      return;
    }

    setCapacities((prev) => resizeArray(prev, departmentCount, null));
    setMaxCaps((prev) => resizeArray(prev, departmentCount, null));
    setRegions((prev) => resizeArray(prev, departmentCount, null));
    setDepartmentNames((prev) => resizeArray(prev, departmentCount, ""));
    setEmployeeNames((prev) => resizeArray(prev, employeeCount, ""));

    setStoreInput({
      capacities: resizeArray(input.capacities, departmentCount, 0),
      proposer_prefs: resizeArray(input.proposer_prefs, employeeCount, []),
      receiver_prefs: resizeArray(input.receiver_prefs, departmentCount, []),
    });

    setPhase("constraint");
  }

  function handleConstraintNext() {
    if (constraintType === "") {
      setConstraintError("制約種別を選択してください。");
      return;
    }
    setConstraintError(undefined);
    setStoreInput({ constraint_type: constraintType });
    setPhase("names");
  }

  function handleChangeConstraints(next: readonly ConstraintEntry[]) {
    setConstraints([...next]);
  }

  function applyServerErrors(errors: readonly FieldError[]) {
    const grouped = groupFieldErrors(errors);
    setCapacitiesApiErrors(grouped.capacities ?? []);
    const regionalMessages = [
      ...(grouped.max_caps ?? []),
      ...(grouped.regions ?? []),
      ...(grouped.regional_caps ?? []),
    ];
    setRegionalCapApiErrors(regionalMessages);
    setConstraintsApiErrors(grouped.constraints ?? []);

    const knownFields = new Set([
      "capacities",
      "max_caps",
      "regions",
      "regional_caps",
      "constraints",
    ]);
    const leftover = Object.entries(grouped)
      .filter(([field]) => !knownFields.has(field))
      .flatMap(([, messages]) => messages);
    setGeneralErrors(leftover);
  }

  function handleDetailNext() {
    if (constraintType === "") {
      // ConstraintStep を経由しないと到達しない（型ガード）。
      return;
    }

    const capErrors = validateCapacities(capacities);
    setCapacityErrors(capErrors);
    let hasError = Object.keys(capErrors).length > 0;

    let finalMaxCaps: number[] = [];
    let finalRegions: number[] = [];
    let finalRegionalCaps: number[] = [];

    if (constraintType === "regional_cap") {
      const maxCapErrs = validateMaxCaps(capacities, maxCaps);
      const regionErrs = validateRegions(regions, regionCount);
      const regionalCapErrs = validateRegionalCaps(regionalCaps);
      setMaxCapErrors(maxCapErrs);
      setRegionErrors(regionErrs);
      setRegionalCapErrors(regionalCapErrs);

      const hasRegionalFieldError =
        Object.keys(maxCapErrs).length > 0 ||
        Object.keys(regionErrs).length > 0 ||
        Object.keys(regionalCapErrs).length > 0;

      if (hasRegionalFieldError) {
        hasError = true;
        setRegionalCapacitySumError(undefined);
      } else {
        const sumError = validateRegionalCapacitySums(capacities, regions, regionalCaps);
        setRegionalCapacitySumError(sumError);
        if (sumError !== undefined) {
          hasError = true;
        } else {
          // 検証済みのため null を含まない。
          finalMaxCaps = maxCaps as number[];
          finalRegions = regions as number[];
          finalRegionalCaps = regionalCaps as number[];
        }
      }
    } else {
      setMaxCapErrors({});
      setRegionErrors({});
      setRegionalCapErrors({});
      setRegionalCapacitySumError(undefined);
    }

    // クライアント側検証エラーがある場合はサーバー検証エラー表示をクリアして中断する。
    setCapacitiesApiErrors([]);
    setRegionalCapApiErrors([]);
    setConstraintsApiErrors([]);
    setGeneralErrors([]);

    if (hasError) {
      return;
    }

    // 検証済みのため null を含まない。
    const finalCapacities = capacities as number[];

    const patch: Partial<MatchingInput> = {
      capacities: finalCapacities,
      constraint_type: constraintType,
      max_caps: constraintType === "regional_cap" ? finalMaxCaps : null,
      regions: constraintType === "regional_cap" ? finalRegions : null,
      regional_caps: constraintType === "regional_cap" ? finalRegionalCaps : null,
      constraints: constraintType === "general" && constraints.length > 0 ? constraints : null,
    };

    setStoreInput(patch);

    const nextInput: MatchingInput = { ...input, ...patch };

    validateMutation.mutate(nextInput, {
      onSuccess: (result) => {
        if (result.valid) {
          setPhase("completed");
          return;
        }
        applyServerErrors(result.errors);
      },
      onError: (error) => {
        if (error instanceof ApiError) {
          applyServerErrors(error.fieldErrors);
        } else {
          toast({
            title: "接続に失敗しました",
            description: `${error.message}。入力内容は保持されています。再試行してください。`,
            variant: "danger",
          });
        }
      },
    });
  }

  if (needsResumeDecision && !resumeDecided) {
    return <ResumePrompt onResume={handleResume} onDiscard={handleDiscard} />;
  }

  const stepperCurrentId: WizardStepId = phase === "completed" ? "detail" : phase;
  const showCapacitySumWarning =
    employeeCount !== null && isCapacitySumBelowEmployeeCount(capacities, employeeCount);

  return (
    <div className="flex flex-col gap-8">
      <Stepper steps={WIZARD_STEPS} currentStepId={stepperCurrentId} />

      {phase === "scale" && (
        <ScaleStep
          departmentCount={departmentCount}
          employeeCount={employeeCount}
          onChangeDepartmentCount={setDepartmentCount}
          onChangeEmployeeCount={setEmployeeCount}
          errors={scaleErrors}
          onSubmit={handleScaleNext}
        />
      )}

      {phase === "constraint" && (
        <ConstraintStep
          selected={constraintType}
          onSelect={(key) => {
            setConstraintType(key);
            setConstraintError(undefined);
          }}
          error={constraintError}
          onBack={() => setPhase("scale")}
          onSubmit={handleConstraintNext}
        />
      )}

      {phase === "names" && (
        <NamesStep
          departmentNames={departmentNames}
          onChangeDepartmentName={(index, value) =>
            setDepartmentNames((prev) => {
              const next = [...prev];
              next[index] = value;
              return next;
            })
          }
          duplicateDepartmentIndexes={duplicateDepartmentIndexes}
          employeeNames={employeeNames}
          onChangeEmployeeName={(index, value) =>
            setEmployeeNames((prev) => {
              const next = [...prev];
              next[index] = value;
              return next;
            })
          }
          duplicateEmployeeIndexes={duplicateEmployeeIndexes}
          onBack={() => setPhase("constraint")}
          onSubmit={handleNamesNext}
        />
      )}

      {phase === "detail" && constraintType !== "" && (
        <DetailStep
          constraintType={constraintType}
          departmentNames={resolveNames(departmentNames, capacities.length, "部署")}
          capacities={capacities}
          onChangeCapacity={(index, value) =>
            setCapacities((prev) => {
              const next = [...prev];
              next[index] = value;
              return next;
            })
          }
          capacityErrors={capacityErrors}
          showCapacitySumWarning={showCapacitySumWarning}
          capacitiesApiErrors={capacitiesApiErrors}
          maxCaps={maxCaps}
          onChangeMaxCap={(index, value) =>
            setMaxCaps((prev) => {
              const next = [...prev];
              next[index] = value;
              return next;
            })
          }
          maxCapErrors={maxCapErrors}
          regionCount={regionCount}
          onChangeRegionCount={(value) => {
            setRegionCount(value);
            setRegionalCaps((prev) => resizeArray(prev, value, null));
          }}
          regions={regions}
          onChangeRegion={(index, value) =>
            setRegions((prev) => {
              const next = [...prev];
              next[index] = value;
              return next;
            })
          }
          regionErrors={regionErrors}
          regionalCaps={regionalCaps}
          onChangeRegionalCap={(index, value) =>
            setRegionalCaps((prev) => {
              const next = [...prev];
              next[index] = value;
              return next;
            })
          }
          regionalCapErrors={regionalCapErrors}
          regionalCapacitySumError={regionalCapacitySumError}
          regionalCapApiErrors={regionalCapApiErrors}
          constraints={constraints}
          onChangeConstraints={handleChangeConstraints}
          employeeNames={resolveNames(employeeNames, employeeNames.length, "社員")}
          constraintsApiErrors={constraintsApiErrors}
          generalErrors={generalErrors}
          isSubmitting={validateMutation.isPending}
          onBack={() => setPhase("names")}
          onSubmit={handleDetailNext}
        />
      )}

      {phase === "completed" && <CompletedPanel onBack={() => setPhase("detail")} />}
    </div>
  );
}
