import { cn } from "../../../shared/lib";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../shared/ui";
import { CONSTRAINT_TYPE_OPTIONS } from "../lib/constraintTypes";
import type { ConstraintTypeKey } from "../lib/constraintTypes";

import { FieldErrorText } from "./FieldErrorText";

export interface ConstraintStepProps {
  selected: ConstraintTypeKey | "";
  onSelect: (key: ConstraintTypeKey) => void;
  error?: string | undefined;
  onBack: () => void;
  onSubmit: () => void;
}

/** ウィザード ステップ2（制約種別の選択カード）。 */
export function ConstraintStep({
  selected,
  onSelect,
  error,
  onBack,
  onSubmit,
}: ConstraintStepProps) {
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
          <CardTitle>制約種別を選択してください</CardTitle>
          <CardDescription>
            配属に適用する制約の種類を選びます。選択後、定員などの詳細を入力します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label="制約種別" className="grid gap-4 sm:grid-cols-3">
            {CONSTRAINT_TYPE_OPTIONS.map((option) => {
              const isSelected = selected === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelect(option.key)}
                  className={cn(
                    "flex flex-col gap-1 rounded-card border p-4 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                    isSelected
                      ? "border-primary-400 bg-primary-50"
                      : "border-slate-200 bg-white hover:bg-slate-50",
                  )}
                >
                  <span className="w-fit rounded-pill bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700">
                    {option.code}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{option.label}</span>
                  <span className="text-xs text-slate-500">{option.summary}</span>
                </button>
              );
            })}
          </div>
          <FieldErrorText message={error} />
        </CardContent>
        <CardFooter className="justify-between">
          <Button type="button" variant="outline" onClick={onBack}>
            戻る
          </Button>
          <Button type="submit">次へ</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
