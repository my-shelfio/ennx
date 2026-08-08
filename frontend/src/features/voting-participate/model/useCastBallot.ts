import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { Ballot } from "../../../entities/voting";
import { apiClient, unwrapVoid } from "../../../shared/api";

export interface CastBallotInput {
  participantToken: string;
  ballot: Ballot;
}

/** 投票の送信(`POST /api/v1/voting/p/{token}/ballots`、204 No Content)。 */
export function useCastBallot(): UseMutationResult<void, Error, CastBallotInput> {
  return useMutation({
    mutationFn: ({ participantToken, ballot }) =>
      unwrapVoid(
        apiClient.POST("/api/v1/voting/p/{participant_token}/ballots", {
          params: { path: { participant_token: participantToken } },
          body: ballot,
        }),
      ),
  });
}
