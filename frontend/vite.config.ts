import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
// vite ではなく vitest/config から defineConfig を取ることで、triple-slash reference なしに
// `test` フィールドの型（vitest 拡張分）を含む vite の UserConfig 型を得る。
import { configDefaults, defineConfig } from "vitest/config";

// Vite と Vitest の設定。
// Tailwind CSS v4 は Vite プラグイン経由で有効化する（tailwind.config は不要）。
// 残存テストは parseEvents / validation の純粋関数のみのため、DOM 環境
// （jsdom）とテストセットアップ（testing-library）は不要。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // e2e/ は Playwright（frontend/playwright.config.ts）の対象であり、vitest では
    // 実行しない（Playwright の test() は vitest のテストランナーと衝突するため
    // 明示的に除外する）。
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
