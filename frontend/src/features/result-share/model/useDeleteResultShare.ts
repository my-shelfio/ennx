import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import { apiClient, unwrapVoid } from "../../../shared/api";

/**
 * 共有データの削除（`DELETE /api/v1/result-share/d/{delete_token}`、204 No Content）。
 * ミューテーションの引数に削除用トークンを渡す。
 */
export function useDeleteResultShare(): UseMutationResult<void, Error, string> {
  return useMutation({
    mutationFn: (deleteToken) =>
      unwrapVoid(
        apiClient.DELETE("/api/v1/result-share/d/{delete_token}", {
          params: { path: { delete_token: deleteToken } },
        }),
      ),
  });
}
