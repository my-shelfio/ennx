import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import type { VotingResults } from "../../../entities/voting";
import { apiClient, unwrap } from "../../../shared/api";

/**
 * 集計結果と性質レポートの取得(`GET /api/v1/voting/a/{token}/results`)。
 * 締切前は 409 を返す(backend `VotingNotClosedError`)ため、`enabled` で
 * 締切後(`is_closed`)にのみ有効化することを呼び出し側に委ねる。
 */
export function useVotingResults(
  adminToken: string,
  enabled: boolean,
): UseQueryResult<VotingResults, Error> {
  return useQuery({
    queryKey: ["voting", "results", adminToken],
    queryFn: () =>
      unwrap(
        apiClient.GET("/api/v1/voting/a/{admin_token}/results", {
          params: { path: { admin_token: adminToken } },
        }),
      ),
    enabled,
    retry: false,
  });
}
