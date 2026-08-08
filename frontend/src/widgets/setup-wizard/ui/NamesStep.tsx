import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../shared/ui";

import { NameField } from "./NameField";

export interface NamesStepProps {
  departmentNames: readonly string[];
  onChangeDepartmentName: (index: number, value: string) => void;
  duplicateDepartmentIndexes: ReadonlySet<number>;

  employeeNames: readonly string[];
  onChangeEmployeeName: (index: number, value: string) => void;
  duplicateEmployeeIndexes: ReadonlySet<number>;

  onBack: () => void;
  onSubmit: () => void;
}

/**
 * ウィザード ステップ「名前」（社員名・部署名、任意入力）。
 * 未入力の項目は結果画面等で「社員N」「部署N」のデフォルト名にフォールバックする。
 * 重複した名前は入力を妨げない警告として表示する（定員合計の警告と同様の方針）。
 */
export function NamesStep({
  departmentNames,
  onChangeDepartmentName,
  duplicateDepartmentIndexes,
  employeeNames,
  onChangeEmployeeName,
  duplicateEmployeeIndexes,
  onBack,
  onSubmit,
}: NamesStepProps) {
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
          <CardTitle>名前を入力してください（任意）</CardTitle>
          <CardDescription>
            未入力の項目は「部署1」「社員1」のような連番名で表示されます。あとから変更できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <section>
            <h3 className="text-sm font-semibold text-slate-900">部署名</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {departmentNames.map((value, index) => (
                <NameField
                  key={index}
                  id={`department-name-${index}`}
                  label={`部署${index + 1}`}
                  value={value}
                  placeholder={`部署${index + 1}`}
                  onChange={(next) => onChangeDepartmentName(index, next)}
                  warning={
                    duplicateDepartmentIndexes.has(index) ? "他の部署名と重複しています。" : undefined
                  }
                />
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">社員名</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {employeeNames.map((value, index) => (
                <NameField
                  key={index}
                  id={`employee-name-${index}`}
                  label={`社員${index + 1}`}
                  value={value}
                  placeholder={`社員${index + 1}`}
                  onChange={(next) => onChangeEmployeeName(index, next)}
                  warning={
                    duplicateEmployeeIndexes.has(index) ? "他の社員名と重複しています。" : undefined
                  }
                />
              ))}
            </div>
          </section>
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
