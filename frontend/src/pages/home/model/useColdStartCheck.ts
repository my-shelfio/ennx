import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { apiClient, unwrap } from "../../../shared/api";

async function pingHealth(): Promise<true> {
  await unwrap(apiClient.GET("/healthz", {}));
  // React Query はクエリ結果に undefined を許容しないため、成功を true で表す。
  return true;
}

/**
 * バックエンド（Render Free）のコールドスタート対策。
 * ホーム画面表示時に /healthz へ疎通確認し、起動待ちであることをローディング表示で
 * 案内する。QueryClient の自動リトライ（query-client.ts）に加え、失敗が確定した後は
 * 呼び出し側で手動の再試行（refetch）を提供できるようにする
 * （失敗しても画面の状態は変わらず、何度でも再試行できる）。
 */
export function useColdStartCheck(): UseQueryResult<true, Error> {
  return useQuery({
    queryKey: ["healthz"],
    queryFn: pingHealth,
  });
}
