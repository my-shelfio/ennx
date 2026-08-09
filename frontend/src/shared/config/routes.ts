/**
 * アプリ全体で使うルートパスの定数。
 * パス文字列の直書きを排除し、ルート構成の変更（マッチング機能の /matching/ 配下への
 * 移設など）をここに一元化する。将来モジュール（情報共有・インセンティブ設計）を
 * 追加する際も、この定数に新しい名前空間を追記する形で拡張する。
 */
export const ROUTES = {
  home: "/",
  matching: {
    setup: "/matching/setup",
    preferences: "/matching/preferences",
    result: "/matching/result",
  },
  voting: {
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
 * 旧 URL（/matching/ 配下への移設前のパス）。
 * ブックマーク・共有リンクの互換性を保つため、リダイレクト元として恒久的に維持する。
 */
export const LEGACY_ROUTES = {
  setup: "/setup",
  preferences: "/preferences",
  result: "/result",
} as const;
