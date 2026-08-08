import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

/**
 * API のベース URL（未設定時は相対パス＝同一オリジン。shared/api 統合前の暫定実装）。
 * shared/api の API クライアントがマージされた後は、そちらの fetch 基盤に寄せる。
 */
// 末尾スラッシュがあっても "//healthz" にならないよう取り除く。
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

async function pingHealth(): Promise<true> {
  const response = await fetch(`${API_BASE_URL}/healthz`, { method: "GET" });
  if (!response.ok) {
    throw new Error(`ヘルスチェックに失敗しました（status: ${response.status}）`);
  }
  // React Query はクエリ結果に undefined を許容しないため、成功を true で表す。
  return true;
}

/**
 * バックエンド（Render Free）のコールドスタート対策。
 * ホーム画面表示時に /healthz へ疎通確認し、起動待ちであることをローディング表示で
 * 案内する。QueryClient の自動リトライ（query-client.ts）に加え、失敗が確定した後は
 * 呼び出し側で手動の再試行（refetch）を提供できるようにする
 * （例外フロー 10a「再試行しても入力内容は失われない」と同じ方針）。
 */
export function useColdStartCheck(): UseQueryResult<true, Error> {
  return useQuery({
    queryKey: ["healthz"],
    queryFn: pingHealth,
  });
}
