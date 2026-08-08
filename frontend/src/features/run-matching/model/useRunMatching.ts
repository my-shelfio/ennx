import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { MatchingInput, MatchingResult } from "../../../entities/matching";
import { apiClient, unwrap } from "../../../shared/api";

/**
 * マッチング実行で使う `POST /api/v1/matching/run` の呼び出しフック。
 *
 * 失敗時（コールドスタート・ネットワークエラー・422 バリデーションエラー）は呼び出し側
 * （pages/preferences）でエラートーストを表示する。入力（useMatchingInputStore）は
 * このフックでは変更しないため、失敗しても選好入力画面に留まり再試行できる
 * （例外フロー 10a、入力内容は失われない）。
 */
export function useRunMatching(): UseMutationResult<MatchingResult, Error, MatchingInput> {
  return useMutation({
    mutationFn: (input: MatchingInput) =>
      unwrap(apiClient.POST("/api/v1/matching/run", { body: input })),
  });
}
