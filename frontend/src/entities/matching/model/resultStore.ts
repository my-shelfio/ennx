import { create } from "zustand";

import type { MatchingInput, MatchingResult } from "./types";

/**
 * マッチング実行結果（イベントログ含む）の保持ストア。
 *
 * `useMatchingInputStore` と異なり localStorage には永続化しない
 * （「実行過程をステップ再生で確認する」機能が、ページ再読み込み等で
 * イベントログが保持されていない場合を明示的な例外として扱っており、
 * 再読み込みでの消失を前提とした設計のため）。
 *
 * 結果と一緒に「その結果を計算した入力」も保持する。入力ストアは実行後も編集できるため、
 * 結果画面の希望順位・説明文を入力ストアから導くと、実行後に編集した入力と古い結果が
 * 食い違う。結果の解釈（希望順位・棄却理由の説明など）には必ずこちらの入力を使う。
 */
export interface MatchingResultStore {
  result: MatchingResult | null;
  /** `result` を計算したときの入力（`result` が null のときは null）。 */
  input: MatchingInput | null;
  setResult: (result: MatchingResult, input: MatchingInput) => void;
  clear: () => void;
}

export const useMatchingResultStore = create<MatchingResultStore>()((set) => ({
  result: null,
  input: null,
  setResult: (result, input) => set({ result, input }),
  clear: () => set({ result: null, input: null }),
}));
