import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import type { AdminSession } from "../../../entities/voting";
import { apiClient, unwrap } from "../../../shared/api";

/** 主催者向けセッション情報の取得(`GET /api/v1/voting/a/{token}`)。 */
export function useAdminSession(
  adminToken: string,
  options?: { refetchInterval?: number | false },
): UseQueryResult<AdminSession, Error> {
  return useQuery({
    queryKey: ["voting", "admin-session", adminToken],
    queryFn: () =>
      unwrap(
        apiClient.GET("/api/v1/voting/a/{admin_token}", {
          params: { path: { admin_token: adminToken } },
        }),
      ),
    retry: false,
    // exactOptionalPropertyTypes: refetchInterval が未指定のときはキー自体を省略する
    // (`refetchInterval: undefined` は許容されないため)。
    ...(options?.refetchInterval !== undefined
      ? { refetchInterval: options.refetchInterval }
      : {}),
  });
}
