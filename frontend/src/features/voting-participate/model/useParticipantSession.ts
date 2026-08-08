import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import type { ParticipantSession } from "../../../entities/voting";
import { apiClient, unwrap } from "../../../shared/api";

/**
 * 参加者向けセッション情報の取得(`GET /api/v1/voting/p/{token}`)。
 * 404(無効・期限切れ)・409(締切済み等)は呼び出し側が `error` から判定する
 * (`ApiError.status` を参照、`shared/api/v1/problem-detail.ts`)。
 */
export function useParticipantSession(
  participantToken: string,
): UseQueryResult<ParticipantSession, Error> {
  return useQuery({
    queryKey: ["voting", "participant-session", participantToken],
    queryFn: () =>
      unwrap(
        apiClient.GET("/api/v1/voting/p/{participant_token}", {
          params: { path: { participant_token: participantToken } },
        }),
      ),
    retry: false,
  });
}
