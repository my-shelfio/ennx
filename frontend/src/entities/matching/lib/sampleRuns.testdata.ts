import type { MatchingEvent } from "../model/types";

/**
 * テスト用の実行結果フィクスチャ（サーバーのデモ用サンプル 4 件を実際に実行した結果）。
 * DA（研修医・定員不足）・FDA（地域上限）・CA（NG ペア）のイベントログを含み、
 * イベントログを解釈する純粋関数のテストで使う。
 */
export interface SampleRun {
  input: { proposer_prefs: number[][]; receiver_prefs: number[][] };
  result: {
    algorithm: string;
    employee_names: string[];
    department_names: string[];
    proposer_match: number[];
    receiver_match: number[][];
    cutoff: number[];
    events: MatchingEvent[];
  };
}

type SampleKey = "residency" | "regional-cap" | "ng-pair" | "unmatched";

export const SAMPLE_RUNS: Record<SampleKey, SampleRun> = {
  "residency": {
    input: {
      proposer_prefs: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]],
      receiver_prefs: [[1, 2, 3, 4, 5, 6], [3, 4, 1, 2, 5, 6], [5, 6, 1, 2, 3, 4]],
    },
    result: {
      algorithm: "da",
      employee_names: ["社員1", "社員2", "社員3", "社員4", "社員5", "社員6"],
      department_names: ["内科", "外科", "小児科"],
      proposer_match: [0, 0, 1, 1, 2, 2],
      receiver_match: [[0, 1], [2, 3], [4, 5]],
      cutoff: [],
      events: [
        { round: 1, event_type: "propose", proposer: 0, receiver: 0, reason: null },
        { round: 1, event_type: "propose", proposer: 1, receiver: 0, reason: null },
        { round: 1, event_type: "propose", proposer: 2, receiver: 1, reason: null },
        { round: 1, event_type: "propose", proposer: 3, receiver: 1, reason: null },
        { round: 1, event_type: "propose", proposer: 4, receiver: 2, reason: null },
        { round: 1, event_type: "propose", proposer: 5, receiver: 2, reason: null },
        { round: 1, event_type: "tentative_accept", proposer: 0, receiver: 0, reason: null },
        { round: 1, event_type: "tentative_accept", proposer: 1, receiver: 0, reason: null },
        { round: 1, event_type: "tentative_accept", proposer: 2, receiver: 1, reason: null },
        { round: 1, event_type: "tentative_accept", proposer: 3, receiver: 1, reason: null },
        { round: 1, event_type: "tentative_accept", proposer: 4, receiver: 2, reason: null },
        { round: 1, event_type: "tentative_accept", proposer: 5, receiver: 2, reason: null },
      ],
    },
  },
  "regional-cap": {
    input: {
      proposer_prefs: [[1, 2, 3], [1, 2, 3], [2, 1, 3], [1, 3, 2], [2, 3, 1]],
      receiver_prefs: [[1, 2, 3, 4, 5], [2, 3, 1, 5, 4], [5, 4, 3, 2, 1]],
    },
    result: {
      algorithm: "fda",
      employee_names: ["青木", "石田", "上田", "江藤", "大野"],
      department_names: ["東京本社", "横浜支社", "大阪支社"],
      proposer_match: [0, 1, 2, 2, 2],
      receiver_match: [[0], [1], [4, 3, 2]],
      cutoff: [],
      events: [
        { round: 1, event_type: "propose", proposer: 0, receiver: 0, reason: null },
        { round: 1, event_type: "propose", proposer: 1, receiver: 0, reason: null },
        { round: 1, event_type: "propose", proposer: 2, receiver: 1, reason: null },
        { round: 1, event_type: "propose", proposer: 3, receiver: 0, reason: null },
        { round: 1, event_type: "propose", proposer: 4, receiver: 1, reason: null },
        { round: 1, event_type: "tentative_accept", proposer: 0, receiver: 0, reason: null },
        { round: 1, event_type: "waitlist", proposer: 1, receiver: 0, reason: "定員超過（待機リストへ）" },
        { round: 1, event_type: "reject", proposer: 3, receiver: 0, reason: "設置上限（2人）超過" },
        { round: 1, event_type: "tentative_accept", proposer: 2, receiver: 1, reason: null },
        { round: 1, event_type: "waitlist", proposer: 4, receiver: 1, reason: "定員超過（待機リストへ）" },
        { round: 1, event_type: "reject", proposer: 1, receiver: 0, reason: "地域上限（2人）超過" },
        { round: 1, event_type: "reject", proposer: 4, receiver: 1, reason: "地域上限（2人）超過" },
        { round: 2, event_type: "propose", proposer: 1, receiver: 1, reason: null },
        { round: 2, event_type: "propose", proposer: 3, receiver: 2, reason: null },
        { round: 2, event_type: "propose", proposer: 4, receiver: 2, reason: null },
        { round: 2, event_type: "reject", proposer: 2, receiver: 1, reason: "定員超過（優先順位の高い提案者に押し出し）" },
        { round: 2, event_type: "tentative_accept", proposer: 1, receiver: 1, reason: null },
        { round: 2, event_type: "waitlist", proposer: 2, receiver: 1, reason: "定員超過（待機リストへ）" },
        { round: 2, event_type: "tentative_accept", proposer: 4, receiver: 2, reason: null },
        { round: 2, event_type: "tentative_accept", proposer: 3, receiver: 2, reason: null },
        { round: 2, event_type: "reject", proposer: 2, receiver: 1, reason: "地域上限（2人）超過" },
        { round: 3, event_type: "propose", proposer: 2, receiver: 0, reason: null },
        { round: 3, event_type: "waitlist", proposer: 2, receiver: 0, reason: "定員超過（待機リストへ）" },
        { round: 3, event_type: "reject", proposer: 2, receiver: 0, reason: "地域上限（2人）超過" },
        { round: 4, event_type: "propose", proposer: 2, receiver: 2, reason: null },
        { round: 4, event_type: "tentative_accept", proposer: 2, receiver: 2, reason: null },
      ],
    },
  },
  "ng-pair": {
    input: {
      proposer_prefs: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [3, 1, 2], [2, 3, 1]],
      receiver_prefs: [[1, 3, 4, 5, 2], [3, 5, 1, 2, 4], [4, 2, 1, 3, 5]],
    },
    result: {
      algorithm: "ca",
      employee_names: ["青木", "石田", "上田", "江藤", "大野"],
      department_names: ["企画部", "営業部", "開発部"],
      proposer_match: [0, 2, 1, 2, 1],
      receiver_match: [[0], [2, 4], [1, 3]],
      cutoff: [2, 1, 1],
      events: [
        { round: 1, event_type: "propose", proposer: 0, receiver: 0, reason: "カットオフ 1 のもとで需要に含まれる" },
        { round: 1, event_type: "propose", proposer: 1, receiver: 0, reason: "カットオフ 1 のもとで需要に含まれる" },
        { round: 1, event_type: "propose", proposer: 2, receiver: 1, reason: "カットオフ 1 のもとで需要に含まれる" },
        { round: 1, event_type: "propose", proposer: 4, receiver: 1, reason: "カットオフ 1 のもとで需要に含まれる" },
        { round: 1, event_type: "propose", proposer: 3, receiver: 2, reason: "カットオフ 1 のもとで需要に含まれる" },
        { round: 1, event_type: "cutoff_raise", proposer: null, receiver: 0, reason: "制約超過によりカットオフを 1 → 2 に引き上げ" },
        { round: 2, event_type: "propose", proposer: 0, receiver: 0, reason: "カットオフ 2 のもとで需要に含まれる" },
        { round: 2, event_type: "propose", proposer: 2, receiver: 1, reason: "カットオフ 1 のもとで需要に含まれる" },
        { round: 2, event_type: "propose", proposer: 4, receiver: 1, reason: "カットオフ 1 のもとで需要に含まれる" },
        { round: 2, event_type: "propose", proposer: 1, receiver: 2, reason: "カットオフ 1 のもとで需要に含まれる" },
        { round: 2, event_type: "propose", proposer: 3, receiver: 2, reason: "カットオフ 1 のもとで需要に含まれる" },
        { round: 2, event_type: "tentative_accept", proposer: 0, receiver: 0, reason: "不動点カットオフのもとで確定受入" },
        { round: 2, event_type: "tentative_accept", proposer: 2, receiver: 1, reason: "不動点カットオフのもとで確定受入" },
        { round: 2, event_type: "tentative_accept", proposer: 4, receiver: 1, reason: "不動点カットオフのもとで確定受入" },
        { round: 2, event_type: "tentative_accept", proposer: 1, receiver: 2, reason: "不動点カットオフのもとで確定受入" },
        { round: 2, event_type: "tentative_accept", proposer: 3, receiver: 2, reason: "不動点カットオフのもとで確定受入" },
      ],
    },
  },
  "unmatched": {
    input: {
      proposer_prefs: [[1, 3, 2], [1, 2, 3], [3, 1, 2], [3, 2, 1], [1, 3, 2], [2, 1, 3]],
      receiver_prefs: [[2, 1, 5, 3, 4, 6], [6, 2, 4, 1, 3, 5], [3, 4, 1, 5, 2, 6]],
    },
    result: {
      algorithm: "da",
      employee_names: ["青木", "石田", "上田", "江藤", "大野", "加藤"],
      department_names: ["企画部", "営業部", "開発部"],
      proposer_match: [-1, 0, 2, 1, -1, 1],
      receiver_match: [[1], [5, 3], [2]],
      cutoff: [],
      events: [
        { round: 1, event_type: "propose", proposer: 0, receiver: 0, reason: null },
        { round: 1, event_type: "propose", proposer: 1, receiver: 0, reason: null },
        { round: 1, event_type: "propose", proposer: 2, receiver: 2, reason: null },
        { round: 1, event_type: "propose", proposer: 3, receiver: 2, reason: null },
        { round: 1, event_type: "propose", proposer: 4, receiver: 0, reason: null },
        { round: 1, event_type: "propose", proposer: 5, receiver: 1, reason: null },
        { round: 1, event_type: "tentative_accept", proposer: 1, receiver: 0, reason: null },
        { round: 1, event_type: "reject", proposer: 0, receiver: 0, reason: "定員超過" },
        { round: 1, event_type: "reject", proposer: 4, receiver: 0, reason: "定員超過" },
        { round: 1, event_type: "tentative_accept", proposer: 5, receiver: 1, reason: null },
        { round: 1, event_type: "tentative_accept", proposer: 2, receiver: 2, reason: null },
        { round: 1, event_type: "reject", proposer: 3, receiver: 2, reason: "定員超過" },
        { round: 2, event_type: "propose", proposer: 0, receiver: 2, reason: null },
        { round: 2, event_type: "propose", proposer: 3, receiver: 1, reason: null },
        { round: 2, event_type: "propose", proposer: 4, receiver: 2, reason: null },
        { round: 2, event_type: "tentative_accept", proposer: 3, receiver: 1, reason: null },
        { round: 2, event_type: "reject", proposer: 0, receiver: 2, reason: "定員超過" },
        { round: 2, event_type: "reject", proposer: 4, receiver: 2, reason: "定員超過" },
        { round: 3, event_type: "propose", proposer: 0, receiver: 1, reason: null },
        { round: 3, event_type: "propose", proposer: 4, receiver: 1, reason: null },
        { round: 3, event_type: "reject", proposer: 0, receiver: 1, reason: "定員超過" },
        { round: 3, event_type: "reject", proposer: 4, receiver: 1, reason: "定員超過" },
      ],
    },
  },
};
