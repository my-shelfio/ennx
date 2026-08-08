import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import { apiClient, unwrapVoid } from "../../../shared/api";

/** 投票の締切(`POST /api/v1/voting/a/{token}/close`、204 No Content)。 */
export function useCloseVotingSession(adminToken: string): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrapVoid(
        apiClient.POST("/api/v1/voting/a/{admin_token}/close", {
          params: { path: { admin_token: adminToken } },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["voting", "admin-session", adminToken] });
    },
  });
}
