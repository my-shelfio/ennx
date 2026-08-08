import type { components } from "../../../shared/api";

/**
 * マッチング関連の型。
 * バックエンドの OpenAPI スキーマ（`shared/api`）から直接導出し、二重定義を避ける。
 * フィールド名は API と同じ snake_case・1-indexed 選好リストのまま保持する
 * （インデックス規約、変換はサーバー側でのみ行う）。
 */
export type MatchingInput = components["schemas"]["MatchingRequestSchema"];
export type MatchingResult = components["schemas"]["MatchingRunResponse"];
export type MatchingEvent = components["schemas"]["MatchingEventSchema"];
export type ConstraintEntry = components["schemas"]["ConstraintEntrySchema"];
export type ReportItem = components["schemas"]["ReportItemSchema"];
export type ValidateResult = components["schemas"]["ValidateResponse"];
