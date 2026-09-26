import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { AssignmentInput } from "../../../entities/assignment";
import { apiClient, unwrap } from "../../../shared/api";
import type { components } from "../../../shared/api";

type AssignmentValidateResult = components["schemas"]["AssignmentValidateResponse"];

/**
 * 貼り付け取込を反映した後の事前検証で使う `POST /api/v1/assignment/validate` の呼び出しフック。
 */
export function useValidateAssignmentInput(): UseMutationResult<
  AssignmentValidateResult,
  Error,
  AssignmentInput
> {
  return useMutation({
    mutationFn: (input: AssignmentInput) =>
      unwrap(apiClient.POST("/api/v1/assignment/validate", { body: input })),
  });
}
