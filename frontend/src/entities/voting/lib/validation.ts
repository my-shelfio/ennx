import type { VotingMethod } from "../model/types";

/**
 * 投票作成フォームの制約値。
 *
 * backend（application/voting/dto.py の MAX_TITLE_LENGTH 等、domain/voting/models.py の
 * MIN_OPTIONS/MAX_OPTIONS）と値を一致させる必要がある。OpenAPI スキーマ上の制約
 * （Pydantic の Field(max_length=...)）はバリデーションの安全網として緩めに
 * 設定されており（実際の上限より広い）、ここでの真の上限は手動同期が必要な点に注意する
 * （backend側の値が変わった場合、この定数も追従すること）。
 */
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 10;
export const MAX_TITLE_LENGTH = 100;
export const MAX_OPTION_LENGTH = 50;
export const MIN_DEADLINE_DAYS = 1;
export const MAX_DEADLINE_DAYS = 7;
// backend の MAX_VOTER_NAME_LENGTH（application/voting/dto.py）と一致させる。
export const MAX_VOTER_NAME_LENGTH = 50;

export const VOTING_METHODS: readonly VotingMethod[] = ["plurality", "approval", "ranking"];

export interface VotingCreateFormValues {
  title: string;
  options: string[];
  method: VotingMethod | "";
  deadlineDays: number;
}

export interface VotingCreateFormErrors {
  title?: string;
  options?: string;
  method?: string;
  deadlineDays?: string;
}

/**
 * 投票作成フォームの入力検証。
 * サーバー側検証の事前チェックとして、明らかな不備をここで弾く
 * （最終的な真の検証は backend が行う）。
 */
export function validateVotingCreateForm(values: VotingCreateFormValues): VotingCreateFormErrors {
  const errors: VotingCreateFormErrors = {};

  const title = values.title.trim();
  if (title.length === 0) {
    errors.title = "タイトルを入力してください";
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.title = `タイトルは${MAX_TITLE_LENGTH}文字以内で入力してください`;
  }

  const trimmedOptions = values.options.map((option) => option.trim());
  const nonEmptyOptions = trimmedOptions.filter((option) => option.length > 0);
  if (nonEmptyOptions.length < MIN_OPTIONS) {
    errors.options = `選択肢は${MIN_OPTIONS}件以上入力してください`;
  } else if (trimmedOptions.length > MAX_OPTIONS) {
    errors.options = `選択肢は${MAX_OPTIONS}件以内にしてください`;
  } else if (trimmedOptions.some((option) => option.length === 0)) {
    errors.options = "空欄の選択肢があります。削除するか入力してください";
  } else if (trimmedOptions.some((option) => option.length > MAX_OPTION_LENGTH)) {
    errors.options = `各選択肢は${MAX_OPTION_LENGTH}文字以内で入力してください`;
  } else if (new Set(trimmedOptions).size !== trimmedOptions.length) {
    errors.options = "選択肢が重複しています";
  }

  if (values.method === "") {
    errors.method = "投票方式を選択してください";
  }

  if (
    !Number.isInteger(values.deadlineDays) ||
    values.deadlineDays < MIN_DEADLINE_DAYS ||
    values.deadlineDays > MAX_DEADLINE_DAYS
  ) {
    errors.deadlineDays = `締切は${MIN_DEADLINE_DAYS}〜${MAX_DEADLINE_DAYS}日の範囲で設定してください`;
  }

  return errors;
}

/** フォーム入力から投票作成リクエスト用の deadline（ISO 8601 UTC）を組み立てる。 */
export function buildDeadlineIso(deadlineDays: number, now: Date = new Date()): string {
  const deadline = new Date(now.getTime() + deadlineDays * 24 * 60 * 60 * 1000);
  return deadline.toISOString();
}

export interface BallotFormValues {
  method: VotingMethod;
  numOptions: number;
  voterName: string;
  choice: number | null;
  ranking: number[] | null;
  approvals: number[];
}

export interface BallotRequestBody {
  voter_name: string;
  choice: number | null;
  ranking: number[] | null;
  approvals: number[] | null;
}

/**
 * 投票フォームの入力を method に応じた投票内容フィールドへ変換する。
 * method と無関係のフィールドは常に null にし、サーバーに送らない
 * （backend `_validate_content` は method に対応するフィールドのみを検証するため、
 * 無関係なフィールドを送らないことで意図を明確にする）。
 */
export function buildBallotRequestBody(values: BallotFormValues): BallotRequestBody {
  const voterName = values.voterName.trim();
  switch (values.method) {
    case "plurality":
      return { voter_name: voterName, choice: values.choice, ranking: null, approvals: null };
    case "approval":
      return { voter_name: voterName, choice: null, ranking: null, approvals: values.approvals };
    case "ranking":
      return { voter_name: voterName, choice: null, ranking: values.ranking, approvals: null };
    default:
      return { voter_name: voterName, choice: null, ranking: null, approvals: null };
  }
}

/**
 * `ranking` が 0〜numOptions-1 の各選択肢番号をちょうど 1 回ずつ含む完全順列かどうかを判定する
 * （レビュー指摘対応: 長さが一致するだけでは重複・欠番を検出できないため、値の集合まで検証する）。
 */
function isFullPermutation(ranking: number[], numOptions: number): boolean {
  if (ranking.length !== numOptions) {
    return false;
  }
  const seen = new Set(ranking);
  if (seen.size !== numOptions) {
    return false;
  }
  return ranking.every((value) => Number.isInteger(value) && value >= 0 && value < numOptions);
}

/**
 * 投票フォームが送信可能な状態か（method に応じた必須入力に加え、ニックネームが
 * 入力されているか）を判定する（ニックネームは必須項目）。
 */
export function isBallotComplete(values: BallotFormValues): boolean {
  const trimmedName = values.voterName.trim();
  if (trimmedName.length === 0 || trimmedName.length > MAX_VOTER_NAME_LENGTH) {
    return false;
  }
  switch (values.method) {
    case "plurality":
      return values.choice !== null;
    case "approval":
      return true; // 承認 0 件（誰も承認しない）も有効な投票として許容する。
    case "ranking":
      return values.ranking !== null && isFullPermutation(values.ranking, values.numOptions);
    default:
      return false;
  }
}
