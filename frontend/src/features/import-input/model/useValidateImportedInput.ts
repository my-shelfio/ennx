import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { MatchingInput, ValidateResult } from "../../../entities/matching";
import { apiClient, unwrap } from "../../../shared/api";

/**
 * CSV一括インポート確定後の事前検証で使う `POST /api/v1/matching/validate` の呼び出しフック。
 * features/validate-input の useValidateInput と同一の呼び出しだが、FSD の層依存規則上
 * features 同士は互いに import できない（同層 import 禁止）ため、本フィーチャー内で
 * 独立して定義する。
 */
export function useValidateImportedInput(): UseMutationResult<
  ValidateResult,
  Error,
  MatchingInput
> {
  return useMutation({
    mutationFn: (input: MatchingInput) =>
      unwrap(apiClient.POST("/api/v1/matching/validate", { body: input })),
  });
}
