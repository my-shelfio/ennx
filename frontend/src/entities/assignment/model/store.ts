import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AssignmentInput, AssignmentResult } from "./types";

/** localStorage のキー。入力途中の状態をブラウザに保持する。 */
export const ASSIGNMENT_INPUT_STORAGE_KEY = "ennx.assignment-input";

/** 初期入力（受け入れ人数のみ・社員 4 人 / 部署 2 件）。 */
export const createInitialAssignmentInput = (): AssignmentInput => ({
  constraint_type: "capacity_only",
  capacities: [1, 1],
  agent_prefs: [[], [], [], []],
});

export interface AssignmentInputStore {
  input: AssignmentInput;
  /** 一部フィールドのみを更新する。 */
  setInput: (patch: Partial<AssignmentInput>) => void;
  /** 入力全体を置き換える（サンプル読込等）。 */
  replaceInput: (input: AssignmentInput) => void;
  /** 入力を初期状態に戻す。 */
  clear: () => void;
}

export const useAssignmentInputStore = create<AssignmentInputStore>()(
  persist(
    (set) => ({
      input: createInitialAssignmentInput(),
      setInput: (patch) => set((state) => ({ input: { ...state.input, ...patch } })),
      replaceInput: (input) => set({ input }),
      clear: () => set({ input: createInitialAssignmentInput() }),
    }),
    { name: ASSIGNMENT_INPUT_STORAGE_KEY },
  ),
);

/**
 * 実行結果の保持ストア。
 * イベントログを含むため localStorage には永続化しない（matching の結果ストアと同じ方針）。
 */
export interface AssignmentResultStore {
  result: AssignmentResult | null;
  setResult: (result: AssignmentResult) => void;
  clear: () => void;
}

export const useAssignmentResultStore = create<AssignmentResultStore>()((set) => ({
  result: null,
  setResult: (result) => set({ result }),
  clear: () => set({ result: null }),
}));
