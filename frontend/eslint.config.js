// ESLint 設定
// FSD の層依存規則（上位 → 下位の一方向のみ）と公開 API 規約（index.ts 経由の import）を
// eslint-plugin-boundaries で機械的に強制する。構造検査は steiger（steiger.config.ts）が担う。
import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

// FSD の層依存規則。各層は自分より下位の層のみ import できる。
const fsdLayerPolicies = [
  { from: "app", allow: ["pages", "widgets", "features", "entities", "shared"] },
  { from: "pages", allow: ["widgets", "features", "entities", "shared"] },
  { from: "widgets", allow: ["features", "entities", "shared"] },
  { from: "features", allow: ["entities", "shared"] },
  { from: "entities", allow: ["shared"] },
  { from: "shared", allow: ["shared"] },
].map(({ from, allow }) => ({
  from: { element: { type: from } },
  allow: [{ to: { element: { type: allow } } }],
}));

export default defineConfig([
  globalIgnores(["dist", "coverage"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    // FSD 境界ルール。層の定義は 6 層に対応する。
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      // TypeScript の import（ディレクトリ import の index.ts 解決を含む）を
      // boundaries が解決できるようにする。
      "import/resolver": {
        node: { extensions: [".ts", ".tsx", ".js", ".jsx"] },
      },
      "boundaries/include": ["src/**/*"],
      "boundaries/elements": [
        { type: "app", pattern: "src/app" },
        { type: "pages", pattern: "src/pages/*", capture: ["slice"] },
        { type: "widgets", pattern: "src/widgets/*", capture: ["slice"] },
        { type: "features", pattern: "src/features/*", capture: ["slice"] },
        { type: "entities", pattern: "src/entities/*", capture: ["slice"] },
        { type: "shared", pattern: "src/shared" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          // どの policy にも一致しない import は違反とする。
          // 同層のスライス間 import は allow されないため禁止になる
          // （同一スライス内の import はこのルールの対象外なので許可される）。
          default: "disallow",
          message:
            "FSD の層依存規則に違反しています（{{from.element.type}} から {{to.element.type}} は import できません）",
          policies: [
            ...fsdLayerPolicies,
            // 公開 API 規約: スライスを持つ層は index.ts 経由でのみ import を許可する。
            // policies は順に評価され、後の disallow が前の allow を上書きする。
            {
              from: { element: { type: "*" } },
              disallow: [
                {
                  to: {
                    element: {
                      type: ["pages", "widgets", "features", "entities"],
                      internalPath: "!index.{ts,tsx}",
                    },
                  },
                },
              ],
              message:
                "スライスの公開 API（index.ts）を経由して import してください",
            },
          ],
        },
      ],
    },
  },
]);
