import type { components } from "../../../shared/api";

/**
 * 投票関連の型。
 * バックエンドの OpenAPI スキーマ（`shared/api`）から直接導出し、二重定義を避ける
 * （`entities/matching/model/types.ts` と同じ方針）。
 * 選択肢番号は 0-indexed（配列位置）のまま保持する。
 */
export type VotingSessionCreateRequest = components["schemas"]["VotingSessionCreateSchema"];
export type VotingSessionCreated = components["schemas"]["VotingSessionCreatedSchema"];
export type ParticipantSession = components["schemas"]["ParticipantSessionSchema"];
export type AdminSession = components["schemas"]["AdminSessionSchema"];
export type Ballot = components["schemas"]["BallotSchema"];
export type RuleResult = components["schemas"]["RuleResultSchema"];
export type VotingResults = components["schemas"]["VotingResultsSchema"];
/**
 * 参加者向けに公開される集計結果（投票者のニックネーム一覧を含まない）。
 * 主催者向けの `VotingResults` はこの型の全項目を含むため、結果表示・エクスポートは
 * この型で受け取れば両方に使える。
 */
export type PublicVotingResults = components["schemas"]["PublicVotingResultsSchema"];
export type VotingReportItem = components["schemas"]["ReportItemSchema"];

/** 投票方式キー（backend: application/voting/dto.py の VOTING_METHODS と対応）。 */
export type VotingMethod = "plurality" | "approval" | "ranking";

/** 投票方式の表示名・平易な説明・向いている場面・参加者の手間。 */
export interface VotingMethodInfo {
  label: string;
  description: string;
  /** どのような場面に向いているか（作成画面で方式選びの手がかりとして表示する）。 */
  suitedFor: string;
  /** 参加者が投票時に行う操作の手間。 */
  effort: string;
}

export const VOTING_METHOD_INFO: Record<VotingMethod, VotingMethodInfo> = {
  plurality: {
    label: "多数決",
    description: "最も多くの票を集めた案が選ばれます。1人1票、案を1つだけ選びます。",
    suitedFor: "1案をすばやく選びたいとき・案が少ないとき",
    effort: "1クリック（案を1つ選ぶだけ）",
  },
  approval: {
    label: "承認投票",
    description: "賛成できる案をいくつでも選べます。最も多く承認された案が選ばれます。",
    suitedFor: "許容できる案を絞りたいとき・似た案で票が割れるのを避けたいとき",
    effort: "複数選択（賛成できる案にチェックを付ける）",
  },
  ranking: {
    label: "順位付け（ボルダ方式）",
    description:
      "好ましい順にすべての案を並べます。順位に応じた点数（ボルダ点）で集計し、他の方式（コンドルセ方式等）との比較も確認できます。",
    suitedFor: "優先順位まで知りたいとき・方式による結果の違いも確かめたいとき",
    effort: "全案の並べ替え（案が多いほど手間が増える）",
  },
};

/** 投票ルールキー→表示名（結果画面の比較表示用）。 */
export const RULE_LABELS: Record<string, string> = {
  plurality: "多数決",
  borda: "ボルダ方式",
  approval: "承認投票",
  condorcet: "コンドルセ方式",
};
