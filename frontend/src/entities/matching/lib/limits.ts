/**
 * 規模の上限値。openapi.json（MatchingRequestSchema）の maxItems と一致させる。
 *
 * widgets/setup-wizard（ステップ間検証）・features/import-input（CSV一括インポートの
 * 上限超過チェック）の双方が同じ上限値を必要とするため entities 層に置く
 * （FSD 層依存規則上、features は widgets に依存できない）。
 */
export const DEPARTMENT_COUNT_MAX = 50;
export const EMPLOYEE_COUNT_MAX = 100;
