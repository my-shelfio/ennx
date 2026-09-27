import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import type { PublicVotingResults } from "../../../entities/voting";
import { apiClient, unwrap } from "../../../shared/api";

/**
 * 参加者向けに公開された集計結果の取得(`GET /api/v1/voting/p/{token}/results`)。
 * 結果公開の設定がない投票・締切前の投票は 404 を返すため、`enabled` で
 * セッション情報の `results_available` が true のときにのみ有効化することを
 * 呼び出し側に委ねる。
 */
export function usePublicVotingResults(
  participantToken: string,
  enabled: boolean,
): UseQueryResult<PublicVotingResults, Error> {
  return useQuery({
    queryKey: ["voting", "public-results", participantToken],
    queryFn: () =>
      unwrap(
        apiClient.GET("/api/v1/voting/p/{participant_token}/results", {
          params: { path: { participant_token: participantToken } },
        }),
      ),
    enabled,
    retry: false,
  });
}
