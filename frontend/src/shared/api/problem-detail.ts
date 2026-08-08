import type { components } from "./schema";

export type ProblemDetail = components["schemas"]["ProblemDetail"];
export type FieldError = components["schemas"]["FieldErrorSchema"];

/** レスポンスボディが RFC 9457 の ProblemDetail 形式かどうかを判定する。 */
export function isProblemDetail(value: unknown): value is ProblemDetail {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.title === "string" && typeof candidate.status === "number";
}

/**
 * API エラーを表す例外。
 * RFC 9457 の ProblemDetail をそのまま保持し、`fieldErrors` でフィールド単位の
 * エラー（設定ウィザードのインライン検証等）に簡単にアクセスできるようにする。
 */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetail;

  constructor(problem: ProblemDetail) {
    super(problem.detail || problem.title);
    this.name = "ApiError";
    this.status = problem.status;
    this.problem = problem;
  }

  get fieldErrors(): FieldError[] {
    return this.problem.errors ?? [];
  }

  /** 特定フィールドに対応するエラーメッセージ一覧を返す。 */
  messagesFor(field: string): string[] {
    return this.fieldErrors
      .filter((error) => error.field === field)
      .map((error) => error.message);
  }
}

/**
 * ネットワークエラー等、ProblemDetail 形式でないエラーを表す例外。
 */
export class UnknownApiError extends Error {
  constructor(cause: unknown) {
    super("APIリクエストに失敗しました");
    this.name = "UnknownApiError";
    this.cause = cause;
  }
}
