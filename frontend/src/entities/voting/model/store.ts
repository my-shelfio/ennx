import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 参加用トークン（participant_token）ごとに、直近投稿したニックネームを端末内
 * （localStorage）に保持するストア。
 *
 * 重複投票（上書き）の判定は、端末内トークンではなくニックネームの完全一致（前後空白のみ除去）で行う。
 * そのため本ストアは重複判定には使わず、参加者が同じ端末から投票し直す際に
 * ニックネーム入力欄へ前回値を補完する UX 目的のみに用いる
 * （真の判定は常にサーバー側でニックネームにより行われる）。
 */
export const VOTING_NICKNAME_STORAGE_KEY = "ennx.voting-nickname";

export interface VotingNicknameStore {
  nicknameByParticipantToken: Record<string, string>;
  /** 指定した参加用トークンで直近使用したニックネームを返す（未保存なら undefined）。 */
  getNickname: (participantToken: string) => string | undefined;
  /** 指定した参加用トークンのニックネームを保存する。 */
  setNickname: (participantToken: string, nickname: string) => void;
}

export const useVotingNicknameStore = create<VotingNicknameStore>()(
  persist(
    (set, get) => ({
      nicknameByParticipantToken: {},
      getNickname: (participantToken) => get().nicknameByParticipantToken[participantToken],
      setNickname: (participantToken, nickname) => {
        set((state) => ({
          nicknameByParticipantToken: {
            ...state.nicknameByParticipantToken,
            [participantToken]: nickname,
          },
        }));
      },
    }),
    { name: VOTING_NICKNAME_STORAGE_KEY },
  ),
);
