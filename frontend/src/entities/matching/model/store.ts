import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { MatchingInput } from "./types";

/** localStorage のキー。入力途中の状態をブラウザに保持する。 */
export const MATCHING_INPUT_STORAGE_KEY = "ennx.matching-input";

export const createInitialMatchingInput = (): MatchingInput => ({
  constraint_type: "",
  capacities: [],
  proposer_prefs: [],
  receiver_prefs: [],
});

/**
 * CSV一括インポート等、ウィザードの各ステップ検証を経ずに入力の複数フィールドを
 * まとめて確定させる際のパッチ。`capacities` を含む場合、部署数
 * （capacities.length）が変わりうるため、地域制約（regional_cap）関連フィールド
 * （max_caps / regions / regional_caps）と追加制約（constraints）は、このパッチに
 * 明示的に含めない限り自動でリセットする（インデックスの不整合を避けるため。
 * setInput の単純マージではこのリセットができない）。
 */
export type BulkInputPatch = Partial<MatchingInput>;

export interface MatchingInputStore {
  input: MatchingInput;
  /** 一部フィールドのみを更新する（ウィザードの各ステップからの入力用）。 */
  setInput: (patch: Partial<MatchingInput>) => void;
  /** 入力全体を置き換える（サンプル読込等）。 */
  replaceInput: (input: MatchingInput) => void;
  /**
   * 入力の複数フィールドをまとめて確定させる（CSV一括インポート向け）。
   * `capacities` の要素数が変わる場合、地域制約関連フィールドを自動でリセットする。
   */
  setBulkInput: (patch: BulkInputPatch) => void;
  /** 入力をクリアする（「入力データをクリア」導線）。 */
  clear: () => void;
}

export const useMatchingInputStore = create<MatchingInputStore>()(
  persist(
    (set) => ({
      input: createInitialMatchingInput(),
      setInput: (patch) =>
        set((state) => ({ input: { ...state.input, ...patch } })),
      replaceInput: (input) => set({ input }),
      setBulkInput: (patch) =>
        set((state) => {
          const departmentCountChanged =
            patch.capacities !== undefined &&
            patch.capacities.length !== state.input.capacities.length;

          return {
            input: {
              ...state.input,
              ...patch,
              max_caps: departmentCountChanged
                ? null
                : (patch.max_caps ?? state.input.max_caps ?? null),
              regions: departmentCountChanged
                ? null
                : (patch.regions ?? state.input.regions ?? null),
              regional_caps: departmentCountChanged
                ? null
                : (patch.regional_caps ?? state.input.regional_caps ?? null),
              constraints: departmentCountChanged
                ? null
                : (patch.constraints ?? state.input.constraints ?? null),
            },
          };
        }),
      clear: () => {
        set({ input: createInitialMatchingInput() });
        useMatchingInputStore.persist.clearStorage();
      },
    }),
    {
      name: MATCHING_INPUT_STORAGE_KEY,
      partialize: (state) => ({ input: state.input }),
    },
  ),
);
