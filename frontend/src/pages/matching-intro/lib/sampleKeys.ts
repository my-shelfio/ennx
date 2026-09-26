/**
 * 導入ページの性質・アルゴリズム解説から直接読み込むサンプルのキー。
 * 値はバックエンドのサンプル一覧（`GET /api/v1/samples`）のキーと一致させる。
 */
export const SAMPLE_KEYS = {
  /** 研修医マッチング風（定員のみ・全員配属・安定）。既定サンプル。 */
  residency: "residency",
  /** 地域上限が効いて希望が繰り下がる例（FDA）。 */
  regionalCap: "regional-cap",
  /** NG ペアによりカットオフが引き上がる例（CA）。 */
  ngPair: "ng-pair",
  /** 定員不足で未配属が出る例。 */
  unmatched: "unmatched",
} as const;
