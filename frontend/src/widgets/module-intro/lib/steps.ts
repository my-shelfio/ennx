/**
 * 全モジュール共通の「進め方」4ステップの見出し。
 * 各モジュールの導入ページは説明文だけを差し替え、見出しはここで固定することで、
 * どのモジュールでも同じ手順で使えることを示す。
 */
export const MODULE_INTRO_STEP_TITLES = [
  "入れる",
  "実行する",
  "結果と過程を見る",
  "説明に使う",
] as const;

/** 4ステップそれぞれの説明文（見出しと同じ並び順）。 */
export type ModuleIntroStepDescriptions = readonly [string, string, string, string];
