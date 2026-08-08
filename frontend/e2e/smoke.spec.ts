import { expect, test } from "@playwright/test";

/**
 * E2E スモークテスト（テスト容易性要件）。
 * 「サンプルデータで試す」→ 実行 → 結果画面のサマリーカード表示までの 1 本のシナリオを検証する
 * 維持コスト最小化のため、E2E はこのシナリオ 1 本に絞る（他のフローはフロント単体テスト・
 * API テストで担保する）。
 * マッチング機能は /matching/ 配下に名前空間化されている（#114）。
 */
test("サンプルデータで試す → 実行 → サマリーカード表示", async ({ page }) => {
  await page.goto("/");

  // ホームには「サンプルデータで試す」CTA がヒーローとデモセクションの 2 箇所にある（#128）。
  // 先頭（ヒーロー内）のものをクリックする。
  await page.getByRole("link", { name: "サンプルデータで試す" }).first().click();
  await page.waitForURL(/\/matching\/preferences$/);

  const runButton = page.getByRole("button", { name: "マッチングを実行" });
  await expect(runButton).toBeEnabled();
  await runButton.click();

  await page.waitForURL(/\/matching\/result$/);
  await expect(page.getByText("マッチ数 / 全社員")).toBeVisible();
  await expect(page.getByText("充足率")).toBeVisible();
  await expect(page.getByText("第1希望配属率")).toBeVisible();
});

/**
 * 旧 URL（/matching/ 配下への移設前のパス）が新パスへリダイレクトされることを確認する（#114）。
 * ブックマーク・共有リンクの互換性維持がこの機能の主なリスク対策のため、独立したテストとする。
 */
test("旧 URL（/setup）は /matching/setup へリダイレクトされる", async ({ page }) => {
  await page.goto("/setup");
  await page.waitForURL(/\/matching\/setup$/);
});
