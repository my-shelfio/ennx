import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ReceiverPrefsSettings } from "../lib/commonRanking";
import { createDefaultReceiverPrefsSettings } from "../lib/commonRanking";

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
  /**
   * 部署 → 社員の選好の入力方式（部署ごと / 全部署共通の評価順位）と共通順位・個別設定。
   * API には送らない画面側の設定のため `input` とは分けて保持する（`input.receiver_prefs` は
   * 常に展開済みの値を持つ）。以前の保存データには無いため、読み込み時は既定値
   * （部署ごとモード）で補われる。
   */
  receiverPrefsSettings: ReceiverPrefsSettings;
  /** 部署 → 社員の選好の入力方式の設定を更新する（選好入力画面から）。 */
  setReceiverPrefsSettings: (settings: ReceiverPrefsSettings) => void;
  /** 一部フィールドのみを更新する（ウィザードの各ステップからの入力用）。 */
  setInput: (patch: Partial<MatchingInput>) => void;
  /** 入力全体を置き換える（サンプル読込等）。入力方式は部署ごとモードへ戻す。 */
  replaceInput: (input: MatchingInput) => void;
  /**
   * 入力の複数フィールドをまとめて確定させる（CSV一括インポート向け）。
   * `capacities` の要素数が変わる場合、地域制約関連フィールドを自動でリセットする。
   * 取り込んだ選好は部署ごとの値のため、入力方式は部署ごとモードへ戻す。
   */
  setBulkInput: (patch: BulkInputPatch) => void;
  /** 入力をクリアする（「入力データをクリア」導線）。 */
  clear: () => void;
}

export const useMatchingInputStore = create<MatchingInputStore>()(
  persist(
    (set) => ({
      input: createInitialMatchingInput(),
      receiverPrefsSettings: createDefaultReceiverPrefsSettings(),
      setReceiverPrefsSettings: (receiverPrefsSettings) => set({ receiverPrefsSettings }),
      setInput: (patch) =>
        set((state) => ({ input: { ...state.input, ...patch } })),
      replaceInput: (input) =>
        set({ input, receiverPrefsSettings: createDefaultReceiverPrefsSettings() }),
      setBulkInput: (patch) =>
        set((state) => {
          const departmentCountChanged =
            patch.capacities !== undefined &&
            patch.capacities.length !== state.input.capacities.length;

          return {
            receiverPrefsSettings: createDefaultReceiverPrefsSettings(),
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
        set({
          input: createInitialMatchingInput(),
          receiverPrefsSettings: createDefaultReceiverPrefsSettings(),
        });
        useMatchingInputStore.persist.clearStorage();
      },
    }),
    {
      name: MATCHING_INPUT_STORAGE_KEY,
      partialize: (state) => ({
        input: state.input,
        receiverPrefsSettings: state.receiverPrefsSettings,
      }),
    },
  ),
);
