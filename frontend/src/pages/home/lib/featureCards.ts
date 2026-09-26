import { ROUTES } from "../../../shared/config";

export interface FeatureCard {
  key: string;
  title: string;
  /** そのモジュールが対応する課題の一文。 */
  problem: string;
  description: string;
  ctaLabel: string;
  href: string;
}

/**
 * ホーム画面「今使える機能」セクションのカードデータ。
 * 配属マッチング・割り当て・投票を対等に提示し、リンク先は各モジュールの導入ページとする
 * （初回訪問者に説明を経由させるため。実行画面へはグローバルナビから直行できる）。
 * 将来モジュール（オークション理論・インセンティブ設計など）が実装され次第、
 * この配列に1件追加するだけでカードグリッドが拡張できる構造にする。
 */
export const FEATURE_CARDS: readonly FeatureCard[] = [
  {
    key: "matching",
    title: "配属マッチング",
    problem: "希望を集めたのに、配属を決めきれない。",
    description:
      "部署と社員それぞれの希望から、安定性が理論的に保証された配属案を作成できます。ステップ再生で決定過程を確認できます。",
    ctaLabel: "配属マッチングを見る",
    href: ROUTES.matching.intro,
  },
  {
    key: "assignment",
    title: "割り当て",
    problem: "配る側に優劣の基準がなく、公平に配れない。",
    description:
      "部署の側で候補者に順位をつけられない配分（席替え・持ち回り・案件アサインなど）を、社員の希望順位だけで決められます。配属される確率と、実際に配るためのくじを提示します。",
    ctaLabel: "割り当てを見る",
    href: ROUTES.assignment.intro,
  },
  {
    key: "voting",
    title: "投票・合意形成",
    problem: "多数決で決めたが、その結論に納得が得られない。",
    description:
      "複数案から1つを選ぶ意思決定を、投票ルールごとの結果と性質つきで可視化できます。匿名の参加URLを配布するだけで、登録なしに参加者を集められます。",
    ctaLabel: "投票・合意形成を見る",
    href: ROUTES.voting.intro,
  },
] as const;
