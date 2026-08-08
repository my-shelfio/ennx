import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { VotingSessionCreateRequest, VotingSessionCreated } from "../../../entities/voting";
import { apiClient, unwrap } from "../../../shared/api";

/** 投票セッション作成（`POST /api/v1/voting/sessions`）のミューテーションフック。 */
export function useCreateVotingSession(): UseMutationResult<
  VotingSessionCreated,
  Error,
  VotingSessionCreateRequest
> {
  return useMutation({
    mutationFn: (body) => unwrap(apiClient.POST("/api/v1/voting/sessions", { body })),
  });
}
