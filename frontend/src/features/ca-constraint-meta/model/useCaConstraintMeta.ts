import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { apiClient, unwrap } from "../../../shared/api";

export interface CaConstraintFieldMeta {
  name: string;
  label: string;
  fieldType: string;
  helpText: string | null;
}

export interface CaConstraintMeta {
  key: string;
  label: string;
  fields: CaConstraintFieldMeta[];
}

/**
 * CA（general）の追加制約種別メタ情報（`GET /api/v1/meta/ca-constraint-types`）取得フック。
 *
 * 制約レジストリ（application/constraints.py）に登録済みの制約種別と、パラメータの
 * フィールド定義（field_type 等）を返す。widgets/setup-wizard の追加制約フォームは
 * この結果から動的にフィールドを生成するため、制約種別ごとの個別実装を持たない
 * （新しい制約種別が既存の field_type を再利用する場合、フロント側の改修は不要）。
 * 制約レジストリはサーバー実行中に変化しないため再取得しない（`staleTime: Infinity`）。
 */
export function useCaConstraintMeta(): UseQueryResult<CaConstraintMeta[], Error> {
  return useQuery({
    queryKey: ["ca-constraint-types"],
    queryFn: async () => {
      const data = await unwrap(apiClient.GET("/api/v1/meta/ca-constraint-types"));
      return data.ca_constraint_types.map((meta) => ({
        key: meta.key,
        label: meta.label,
        fields: meta.fields.map((f) => ({
          name: f.name,
          label: f.label,
          fieldType: f.field_type,
          helpText: f.help_text ?? null,
        })),
      }));
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}
