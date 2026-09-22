import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { MatchingInput } from "../../../entities/matching";
import { apiClient, unwrap } from "../../../shared/api";

/**
 * サンプルデータ読込で使う `GET /api/v1/sample` の呼び出しフック。
 * 変数にサンプルのキーを渡す（`undefined` のときは既定サンプル）。
 * 他の API 呼び出しフック（useRunMatching 等）と同様に呼び出し側で明示的に
 * トリガーし onSuccess/onError を扱えるよう useMutation を使う。
 */
export function useLoadSample(): UseMutationResult<MatchingInput, Error, string | undefined> {
  return useMutation({
    mutationFn: (key) =>
      unwrap(
        apiClient.GET("/api/v1/sample", {
          params: { query: key === undefined ? {} : { key } },
        }),
      ),
  });
}
