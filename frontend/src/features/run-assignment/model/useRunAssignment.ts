import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { AssignmentInput, AssignmentResult } from "../../../entities/assignment";
import { apiClient, unwrap } from "../../../shared/api";

/**
 * 割り当て実行で使う `POST /api/v1/assignment/run` の呼び出しフック。
 *
 * 失敗時（コールドスタート・ネットワークエラー・422 バリデーションエラー）は
 * 呼び出し側でエラートーストを表示する。入力ストアはこのフックでは変更しないため、
 * 失敗しても入力内容は失われない。
 */
export function useRunAssignment(): UseMutationResult<AssignmentResult, Error, AssignmentInput> {
  return useMutation({
    mutationFn: (input: AssignmentInput) =>
      unwrap(apiClient.POST("/api/v1/assignment/run", { body: input })),
  });
}
