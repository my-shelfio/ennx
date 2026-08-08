import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { MatchingInput, ValidateResult } from "../../../entities/matching";
import { apiClient, unwrap } from "../../../shared/api";

/**
 * 設定ウィザードのステップ間検証で使う `POST /api/v1/matching/validate` の呼び出しフック。
 *
 * リクエスト形式自体の誤り（型・上限超過）は 422（RFC 9457）として `ApiError` が
 * reject される。業務ルール違反（例: FDA の地域上限超過）は 200 + `valid: false` で
 * 返るため、呼び出し側は `errors[]`（`ValidateResponse.errors`）と
 * `ApiError.fieldErrors` の両方をフィールドマッピング対象として扱う必要がある。
 */
export function useValidateInput(): UseMutationResult<
  ValidateResult,
  Error,
  MatchingInput
> {
  return useMutation({
    mutationFn: (input: MatchingInput) =>
      unwrap(apiClient.POST("/api/v1/matching/validate", { body: input })),
  });
}
