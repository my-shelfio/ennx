import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E スモークテスト設定（テスト容易性要件）。
 *
 * バックエンド（FastAPI）が SPA ビルド成果物（frontend/dist）も同一オリジンで配信する
 * 単一サービス構成で `webServer` を起動し、本番相当の構成のままスモークを実行する（CORS・別オリジン起因の差異を避けるため）。
 * ビルド成果物は事前に `npm run build` で生成しておくこと（CI: e2e ジョブ、ローカル: 手動）。
 * 「維持コスト最小のため本数は 1 本に絞る」方針のため、テストは e2e/smoke.spec.ts の1 ファイル・1 シナリオのみを置く想定。
 */
const PORT = process.env.E2E_PORT ?? "8000";
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // cwd はこの設定ファイル（frontend/）からの相対パスでリポジトリルートを指す。
    // main.py の SPA マウントは ENNX_SPA_DIST をプロセスの cwd からの相対パスとして解決する。
    command: `uv run uvicorn main:create_app --factory --app-dir backend/src --host 127.0.0.1 --port ${PORT}`,
    cwd: "..",
    url: `${BASE_URL}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ENNX_SPA_DIST: "frontend/dist",
    },
  },
});
