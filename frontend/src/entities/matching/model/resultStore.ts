import { create } from "zustand";

import type { MatchingResult } from "./types";

/**
 * マッチング実行結果（イベントログ含む）の保持ストア。
 *
 * `useMatchingInputStore` と異なり localStorage には永続化しない
 * （「実行過程をステップ再生で確認する」機能が、ページ再読み込み等で
 * イベントログが保持されていない場合を明示的な例外として扱っており、
 * 再読み込みでの消失を前提とした設計のため）。
 */
export interface MatchingResultStore {
  result: MatchingResult | null;
  setResult: (result: MatchingResult) => void;
  clear: () => void;
}

export const useMatchingResultStore = create<MatchingResultStore>()((set) => ({
  result: null,
  setResult: (result) => set({ result }),
  clear: () => set({ result: null }),
}));
