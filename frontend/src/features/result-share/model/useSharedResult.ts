import { skipToken, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import type { MatchingInput, MatchingResult } from "../../../entities/matching";
import type { SharedResult } from "../../../entities/result-share";
import { ApiError, apiClient, unwrap } from "../../../shared/api";

/** 4xx（未検出・期限切れ・入力不正）は再試行しても結果が変わらないため再試行しない。 */
function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}

export interface SharedMatchingResult {
  /** 共有データ（保存された入力と自動削除日時）の取得状態。 */
  shared: UseQueryResult<SharedResult, Error>;
  /** 共有された入力（取得前は undefined）。マッチング実行 API の入力と同じ形式。 */
  input: MatchingInput | undefined;
  /** 共有された入力から再計算したマッチング結果の取得状態。 */
  result: UseQueryResult<MatchingResult, Error>;
}

/**
 * 閲覧用トークンで共有された入力を取得し、マッチング実行 API で結果を再計算する。
 * サーバーには入力のみが保存されているため、結果は閲覧のたびに計算し直す
 * （マッチングは決定的な処理で、同じ入力からは同じ結果・イベントログが得られる）。
 * 閲覧者自身の入力・実行結果（ブラウザ内のストア）には一切書き込まない。
 */
export function useSharedResult(viewToken: string): SharedMatchingResult {
  const shared = useQuery({
    queryKey: ["result-share", "shared", viewToken],
    queryFn: () =>
      unwrap(
        apiClient.GET("/api/v1/result-share/v/{view_token}", {
          params: { path: { view_token: viewToken } },
        }),
      ),
    retry: shouldRetry,
    staleTime: Infinity,
  });
  const input: MatchingInput | undefined = shared.data?.input;
  const result = useQuery({
    queryKey: ["result-share", "result", viewToken],
    queryFn:
      input === undefined
        ? skipToken
        : () => unwrap(apiClient.POST("/api/v1/matching/run", { body: input })),
    retry: shouldRetry,
    staleTime: Infinity,
  });
  return { shared, input, result };
}
