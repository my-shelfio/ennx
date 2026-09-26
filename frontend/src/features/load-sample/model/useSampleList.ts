import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import type { SampleSummary } from "../../../entities/matching";
import { apiClient, unwrap } from "../../../shared/api";

/**
 * サンプル一覧（`GET /api/v1/samples`）の取得フック。
 * サンプルはサーバー実行中に変化しないため再取得しない（`staleTime: Infinity`）。
 */
export function useSampleList(): UseQueryResult<SampleSummary[], Error> {
  return useQuery({
    queryKey: ["matching-samples"],
    queryFn: async () => (await unwrap(apiClient.GET("/api/v1/samples"))).samples,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
