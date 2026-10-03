import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { ResultShareCreated, ResultShareCreateRequest } from "../../../entities/result-share";
import { apiClient, unwrap } from "../../../shared/api";

/** 閲覧用 URL の発行（`POST /api/v1/result-share/snapshots`）のミューテーションフック。 */
export function useCreateResultShare(): UseMutationResult<
  ResultShareCreated,
  Error,
  ResultShareCreateRequest
> {
  return useMutation({
    mutationFn: (body) => unwrap(apiClient.POST("/api/v1/result-share/snapshots", { body })),
  });
}
