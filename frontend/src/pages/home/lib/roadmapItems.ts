export interface RoadmapItem {
  key: string;
  title: string;
  description: string;
}

/**
 * ホーム画面「今後の展開」帯のデータ。
 * まだ提供していない検討中の理論モジュールを、リンクを持たせない読み物として
 * 列挙する（未提供機能をあるように見せないため）。提供開始時はここから
 * 削除し、`featureCards.ts` 側に移す。
 */
export const ROADMAP_ITEMS: readonly RoadmapItem[] = [
  {
    key: "auction",
    title: "オークション理論",
    description: "限られた資源・ポストの配分を、価格づけの仕組みから可視化する検討をしています。",
  },
  {
    key: "incentive-design",
    title: "インセンティブ設計",
    description:
      "契約理論に基づき、報酬設計・目標設定の歪みを可視化する検討をしています。",
  },
] as const;
