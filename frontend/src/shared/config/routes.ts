/**
 * アプリ全体で使うルートパスの定数。
 * パス文字列の直書きを排除し、ルート構成の変更（マッチング機能の /matching/ 配下への
 * 移設など）をここに一元化する。将来モジュール（インセンティブ設計など）を
 * 追加する際も、この定数に新しい名前空間を追記する形で拡張する。
 *
 * 各モジュールは「名前空間直下 = 導入ページ（intro）」「下位パス = 実行画面」で構成する。
 * ホームのカードからは導入ページへ、グローバルナビからは実行画面へ直行させることで、
 * 初回訪問者には説明を経由させつつ再訪ユーザーのクリック数を増やさない。
 */
export const ROUTES = {
  home: "/",
  matching: {
    intro: "/matching",
    setup: "/matching/setup",
    preferences: "/matching/preferences",
    result: "/matching/result",
  },
  assignment: {
    intro: "/assignment",
    run: "/assignment/run",
  },
  voting: {
    intro: "/voting",
    create: "/voting/create",
    participate: "/voting/v/:token",
    manage: "/voting/m/:token",
  },
} as const;

/**
 * 投票の参加用 URL を組み立てる（`ROUTES.voting.participate` の `:token` を実値に置換）。
 * 主催者への表示・コピー用に使う（`window.location.origin` は呼び出し側で付与する）。
 */
export function buildVotingParticipateUrl(token: string): string {
  return `/voting/v/${token}`;
}

/** 投票の管理用 URL を組み立てる（`ROUTES.voting.manage` の `:token` を実値に置換）。 */
export function buildVotingManageUrl(token: string): string {
  return `/voting/m/${token}`;
}

/**
 * サンプルデータを読み込んだ状態で実行画面に入るためのクエリ。
 * 導入ページの「サンプルデータで試す」CTA から使う。
 */
export const SAMPLE_QUERY = "?sample=1";

/**
 * 旧 URL（/matching/ 配下への移設前のパス）。
 * ブックマーク・共有リンクの互換性を保つため、リダイレクト元として恒久的に維持する。
 */
export const LEGACY_ROUTES = {
  setup: "/setup",
  preferences: "/preferences",
  result: "/result",
} as const;
