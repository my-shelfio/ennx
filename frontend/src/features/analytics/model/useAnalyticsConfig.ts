import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { apiClient, unwrap } from "../../../shared/api";

export interface AnalyticsConfig {
  gaMeasurementId: string | null;
}

/**
 * アクセス解析設定（GA4 測定ID）の取得フック。
 *
 * `GET /api/v1/meta/analytics-config` は本番環境でのみ測定IDを返し、
 * 開発環境・ローカルでは null を返す（呼び出し元は null のとき GA4 を読み込まない）。
 * 設定はセッション中に変化しないため再取得しない（`staleTime: Infinity`）。
 * 失敗してもアプリの他機能に影響させないため再試行しない（`retry: false`）。
 */
export function useAnalyticsConfig(): UseQueryResult<AnalyticsConfig, Error> {
  return useQuery({
    queryKey: ["analytics-config"],
    queryFn: async () => {
      const data = await unwrap(apiClient.GET("/api/v1/meta/analytics-config"));
      return { gaMeasurementId: data.ga_measurement_id };
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}
