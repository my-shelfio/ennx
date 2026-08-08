/** 制約種別キー（`MatchingRequestSchema.constraint_type` と一致させる）。 */
export type ConstraintTypeKey = "capacity_only" | "regional_cap" | "general";

export interface ConstraintTypeOption {
  key: ConstraintTypeKey;
  /** 内部アルゴリズムの略称（開発ルール準拠）。 */
  code: string;
  label: string;
  summary: string;
}

/**
 * ステップ2（制約種別の選択カード）の選択肢。
 * 説明文は開発ルールの定義に基づく。バックエンドの
 * `/api/v1/meta/constraint-types` も同等のメタ情報を提供するが、選択カードの
 * 表示文言はプロダクト側で固定したいためここでは静的に定義する
 * （home 画面の ALGORITHM_CARDS と同じ方針）。
 */
export const CONSTRAINT_TYPE_OPTIONS: readonly ConstraintTypeOption[] = [
  {
    key: "capacity_only",
    code: "DA",
    label: "定員のみ（DA）",
    summary:
      "各部署の定員のみを制約とする、最も基本的な配属。提案者にとって最適な安定マッチングを実現する。",
  },
  {
    key: "regional_cap",
    code: "FDA",
    label: "地域上限あり（FDA）",
    summary:
      "部署ごとの目標定員に加え、地域（グループ）単位の受け入れ上限を考慮する（研修医マッチング等）。",
  },
  {
    key: "general",
    code: "CA",
    label: "追加制約あり（CA）",
    summary:
      "予算・NGペア・属性人数などの複合的な上限制約に対応する。定員のみの場合は DA と同じ結果になる。",
  },
] as const;

export function findConstraintTypeOption(
  key: string,
): ConstraintTypeOption | undefined {
  return CONSTRAINT_TYPE_OPTIONS.find((option) => option.key === key);
}

/** 文字列が既知の制約種別キーかどうかを判定する型ガード（ストア復元時の型絞り込み用）。 */
export function isConstraintTypeKey(value: string): value is ConstraintTypeKey {
  return CONSTRAINT_TYPE_OPTIONS.some((option) => option.key === value);
}
