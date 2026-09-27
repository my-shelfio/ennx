import type { AdminSession } from "../model/types";

import { MAX_DEADLINE_DAYS, VOTING_METHODS } from "./validation";
import type { VotingCreateFormValues } from "./validation";

/** 主催者画面の「複製して新しく作成」から作成画面へ渡すルーター state。 */
export interface VotingDuplicateState {
  duplicate: VotingCreateFormValues;
}

/**
 * 既存の投票(主催者向けセッション情報)から、複製用の作成フォーム初期値を組み立てる。
 * タイトル・選択肢・補足説明・投票方式・結果公開の設定を引き継ぎ、締切は既定値
 * (最長の日数)に戻す。票は引き継がない(作成フォームには票の入力欄がない)。
 * 作成画面で選べない方式キーの場合は方式を未選択にする。
 */
export function buildDuplicateFormValues(session: AdminSession): VotingCreateFormValues {
  const method = VOTING_METHODS.find((candidate) => candidate === session.method) ?? "";
  return {
    title: session.title,
    options: [...session.options],
    optionDescriptions: session.options.map(
      (_, index) => session.option_descriptions[index] ?? "",
    ),
    method,
    deadlineDays: MAX_DEADLINE_DAYS,
    publishResults: session.publish_results,
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * ルーター state(外部から任意の値が入りうる)から複製元のフォーム値を取り出す。
 * 形が合わない場合(直接アクセス・履歴の state 破損など)は null を返し、空のフォームで始める。
 */
export function readDuplicateFormValues(state: unknown): VotingCreateFormValues | null {
  if (typeof state !== "object" || state === null || !("duplicate" in state)) {
    return null;
  }
  const { duplicate } = state;
  if (typeof duplicate !== "object" || duplicate === null) {
    return null;
  }
  const values: Record<string, unknown> = { ...duplicate };
  const { title, options, optionDescriptions, method, deadlineDays, publishResults } = values;
  if (
    typeof title !== "string" ||
    !isStringArray(options) ||
    !isStringArray(optionDescriptions) ||
    optionDescriptions.length !== options.length ||
    typeof deadlineDays !== "number" ||
    typeof publishResults !== "boolean"
  ) {
    return null;
  }
  const knownMethod = VOTING_METHODS.find((candidate) => candidate === method) ?? "";
  return { title, options, optionDescriptions, method: knownMethod, deadlineDays, publishResults };
}
