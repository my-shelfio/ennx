export interface AlgorithmCard {
  code: string;
  name: string;
  description: string;
}

/**
 * 配属マッチングで選べるアルゴリズム 3 種の解説。
 * 制約の種類に応じて理論的な保証が変わるため、導入ページで違いを提示する。
 */
export const ALGORITHM_CARDS: readonly AlgorithmCard[] = [
  {
    code: "DA",
    name: "受入保留方式（Deferred Acceptance）",
    description:
      "定員制約のもとで、提案者にとって最適な安定マッチングを実現する基本アルゴリズム。",
  },
  {
    code: "FDA",
    name: "柔軟な受入保留方式（Flexible DA）",
    description:
      "地域ごとの受け入れ上限を考慮した配属（研修医マッチング等）。地域上限を守りながら効率的に配属する。",
  },
  {
    code: "CA",
    name: "カットオフ調整（Cutoff Adjustment）",
    description:
      "予算・属性人数などの複合的な上限制約に対応する、提案者最適かつ公平な配属を実現する。",
  },
] as const;
