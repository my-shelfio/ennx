import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { MatchingInput } from "../../../entities/matching";
import { apiClient, unwrap } from "../../../shared/api";

/**
 * サンプルデータ読込で使う `GET /api/v1/sample` の呼び出しフック。
 * パラメータを取らない呼び出しだが、他の API 呼び出しフック（useRunMatching 等）と
 * 同様に呼び出し側で明示的にトリガーし onSuccess/onError を扱えるよう useMutation を使う。
 */
export function useLoadSample(): UseMutationResult<MatchingInput, Error, void> {
  return useMutation({
    mutationFn: () => unwrap(apiClient.GET("/api/v1/sample")),
  });
}
