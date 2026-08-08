import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import { apiClient, unwrapVoid } from "../../../shared/api";

/** 投票データの削除(`DELETE /api/v1/voting/a/{token}`、204 No Content)。 */
export function useDeleteVotingSession(adminToken: string): UseMutationResult<void, Error, void> {
  return useMutation({
    mutationFn: () =>
      unwrapVoid(
        apiClient.DELETE("/api/v1/voting/a/{admin_token}", {
          params: { path: { admin_token: adminToken } },
        }),
      ),
  });
}
