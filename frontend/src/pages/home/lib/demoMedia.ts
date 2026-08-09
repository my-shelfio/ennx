export interface DemoMedia {
  src: string;
  alt: string;
}

// デモ素材（プレースホルダ）。
// 実際の操作画面を収録した GIF/動画への差し替えは follow-up タスク。
const ANIMATED_SRC = "/demo-preview-animated.svg";
const STATIC_SRC = "/demo-preview-static.svg";
const ALT_TEXT =
  "サンプルデータでの「設定 → 選好入力 → 実行 → ステップ再生」の流れを示すイメージ画面";

/**
 * prefers-reduced-motion の設定に応じて表示するデモ素材を切り替える。
 * true（視差効果を減らす設定が有効）の場合は静止画にフォールバックし、自動再生しない。
 */
export function getDemoMedia(prefersReducedMotion: boolean): DemoMedia {
  return {
    src: prefersReducedMotion ? STATIC_SRC : ANIMATED_SRC,
    alt: ALT_TEXT,
  };
}
