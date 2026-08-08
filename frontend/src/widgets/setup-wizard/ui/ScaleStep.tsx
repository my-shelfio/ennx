import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../shared/ui";
import { DEPARTMENT_COUNT_MAX, EMPLOYEE_COUNT_MAX } from "../lib/validation";
import type { ScaleStepErrors } from "../lib/validation";

import { NumberField } from "./NumberField";

export interface ScaleStepProps {
  departmentCount: number | null;
  employeeCount: number | null;
  onChangeDepartmentCount: (value: number | null) => void;
  onChangeEmployeeCount: (value: number | null) => void;
  errors: ScaleStepErrors;
  onSubmit: () => void;
}

/** ウィザード ステップ1（規模: 部署数・社員数）。 */
export function ScaleStep({
  departmentCount,
  employeeCount,
  onChangeDepartmentCount,
  onChangeEmployeeCount,
  errors,
  onSubmit,
}: ScaleStepProps) {
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
          <CardTitle>規模を入力してください</CardTitle>
          <CardDescription>
            部署数（最大{DEPARTMENT_COUNT_MAX}）と社員数（最大{EMPLOYEE_COUNT_MAX}）を入力します。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row">
          <NumberField
            id="department-count"
            label="部署数"
            value={departmentCount}
            onChange={onChangeDepartmentCount}
            min={1}
            max={DEPARTMENT_COUNT_MAX}
            error={errors.departmentCount}
            className="flex-1"
          />
          <NumberField
            id="employee-count"
            label="社員数"
            value={employeeCount}
            onChange={onChangeEmployeeCount}
            min={1}
            max={EMPLOYEE_COUNT_MAX}
            error={errors.employeeCount}
            className="flex-1"
          />
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit">次へ</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
