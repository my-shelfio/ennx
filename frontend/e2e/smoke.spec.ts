import { expect, test } from "@playwright/test";

/**
 * E2E スモークテスト（テスト容易性要件）。
 * ホーム → モジュールの導入ページ → サンプル実行 → 結果画面のサマリーカード表示までの
 * 1 本のシナリオを検証する。維持コスト最小化のため、E2E はこのシナリオ 1 本に絞る
 * （他のフローはフロント単体テスト・API テストで担保する）。
 * ホームのカードは各モジュールの導入ページへ、導入ページの CTA が実行画面へ送る。
 */
test("ホーム → 導入ページ → サンプル実行 → サマリーカード表示", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "配属マッチングを見る" }).click();
  await page.waitForURL(/\/matching$/);

  // 導入ページは同じ CTA をヒーローと末尾の 2 箇所に持つ。先頭のものをクリックする。
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
 * 旧 URL（/matching/ 配下への移設前のパス）が新パスへリダイレクトされることを確認する。
 * ブックマーク・共有リンクの互換性維持がこの機能の主なリスク対策のため、独立したテストとする。
 */
test("旧 URL（/setup）は /matching/setup へリダイレクトされる", async ({ page }) => {
  await page.goto("/setup");
  await page.waitForURL(/\/matching\/setup$/);
});
