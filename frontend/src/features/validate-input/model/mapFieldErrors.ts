import type { FieldError } from "../../../shared/api";

/** `field` が null のエラー（フォーム全体に関わるエラー）をまとめるキー。 */
export const GENERAL_FIELD_ERROR_KEY = "_general";

/**
 * RFC 9457 のフィールドエラー一覧（`ProblemDetail.errors` / `ValidateResponse.errors`）を
 * フィールド名 → メッセージ一覧の Record に変換する。
 *
 * `field` が null のエラーは {@link GENERAL_FIELD_ERROR_KEY} にまとめ、
 * 呼び出し側（設定ウィザードの各ステップ）はフィールド名で該当箇所にマッピングできる。
 */
export function groupFieldErrors(
  errors: readonly FieldError[],
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};

  for (const error of errors) {
    const key = error.field ?? GENERAL_FIELD_ERROR_KEY;
    const existing = grouped[key];
    if (existing === undefined) {
      grouped[key] = [error.message];
    } else {
      existing.push(error.message);
    }
  }

  return grouped;
}

/** 指定フィールドのエラーメッセージ一覧を取得する（存在しない場合は空配列）。 */
export function messagesFor(
  grouped: Record<string, string[]>,
  field: string,
): string[] {
  return grouped[field] ?? [];
}
