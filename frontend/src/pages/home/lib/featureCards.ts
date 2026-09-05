import { ROUTES } from "../../../shared/config";

export interface FeatureCard {
  key: string;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
}

/**
 * ホーム画面「今使える機能」セクションのカードデータ。
 * 配属マッチング・割り当て・投票を対等に提示する。将来モジュール（オークション理論・
 * インセンティブ設計など）が実装され次第、この配列に1件追加するだけで
 * カードグリッドが拡張できる構造にする。
 */
export const FEATURE_CARDS: readonly FeatureCard[] = [
  {
    key: "matching",
    title: "配属マッチング",
    description:
      "部署と社員それぞれの希望から、安定性が理論的に保証された配属案を作成できます。ステップ再生で決定過程を確認できます。",
    ctaLabel: "マッチングを始める",
    href: ROUTES.matching.setup,
  },
  {
    key: "assignment",
    title: "割り当て",
    description:
      "部署の側で候補者に順位をつけられない配分（席替え・持ち回り・案件アサインなど）を、社員の希望順位だけで決められます。配属される確率と、実際に配るためのくじを提示します。",
    ctaLabel: "割り当てを始める",
    href: ROUTES.assignment.root,
  },
  {
    key: "voting",
    title: "投票・合意形成",
    description:
      "複数案から1つを選ぶ意思決定を、投票ルールごとの結果と性質つきで可視化できます。匿名の参加URLを配布するだけで、登録なしに参加者を集められます。",
    ctaLabel: "投票を作成する",
    href: ROUTES.voting.create,
  },
] as const;
