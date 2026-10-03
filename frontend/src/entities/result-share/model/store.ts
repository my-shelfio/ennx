import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * このブラウザで発行した閲覧用 URL の一覧を端末内（localStorage）に保持するストア。
 * 削除用トークンは発行時の応答でしか得られないため、発行者が後から結果画面で
 * 削除できるよう、発行したブラウザにのみ保存する（サーバーには発行者を識別する
 * 情報を持たない）。
 */
export const RESULT_SHARE_STORAGE_KEY = "ennx.result-shares";

export interface IssuedResultShare {
  viewToken: string;
  deleteToken: string;
  /** 発行日時（ISO 8601）。 */
  createdAt: string;
  /** 自動削除日時（ISO 8601）。 */
  expiresAt: string;
  /** 一覧で見分けるための規模の要約（例: 「社員 6 名・部署 3 部署」）。社員名は含めない。 */
  summary: string;
}

export interface IssuedResultShareStore {
  shares: IssuedResultShare[];
  /** 発行した閲覧用 URL を先頭に追加する（期限切れのものはこの時点で取り除く）。 */
  addShare: (share: IssuedResultShare, now?: Date) => void;
  /** 削除済み（または削除できなくなった）閲覧用 URL を一覧から取り除く。 */
  removeShare: (viewToken: string) => void;
  clear: () => void;
}

/** 有効期限内の閲覧用 URL のみを返す。 */
export function activeShares(shares: IssuedResultShare[], now: Date): IssuedResultShare[] {
  return shares.filter((share) => new Date(share.expiresAt).getTime() > now.getTime());
}

export const useIssuedResultShareStore = create<IssuedResultShareStore>()(
  persist(
    (set) => ({
      shares: [],
      addShare: (share, now = new Date()) => {
        set((state) => ({ shares: [share, ...activeShares(state.shares, now)] }));
      },
      removeShare: (viewToken) => {
        set((state) => ({
          shares: state.shares.filter((share) => share.viewToken !== viewToken),
        }));
      },
      clear: () => set({ shares: [] }),
    }),
    { name: RESULT_SHARE_STORAGE_KEY },
  ),
);
