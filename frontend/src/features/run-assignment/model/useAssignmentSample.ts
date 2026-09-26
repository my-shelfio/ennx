import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { AssignmentInput } from "../../../entities/assignment";
import { apiClient, unwrap } from "../../../shared/api";

/**
 * `GET /api/v1/assignment/sample` を取得するフック。
 * 初見の利用者が入力なしで結果画面まで到達できるようにする導線で使う。
 */
export function useAssignmentSample(): UseMutationResult<AssignmentInput, Error, void> {
  return useMutation({
    mutationFn: () => unwrap(apiClient.GET("/api/v1/assignment/sample", {})),
  });
}
