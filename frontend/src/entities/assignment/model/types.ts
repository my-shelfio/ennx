import type { components } from "../../../shared/api";

/**
 * 割り当て（PS メカニズム）関連の型。
 * バックエンドの OpenAPI スキーマ（`shared/api`）から直接導出し、二重定義を避ける。
 * フィールド名は API と同じ snake_case・1-indexed 希望順位リストのまま保持する
 * （インデックス規約の変換はサーバー側でのみ行う）。
 *
 * 期待割当・くじの重み・イベントの時刻は「1/2」形式の分数文字列で受け取る
 * （丸めによる誤差を持ち込まないための API 契約）。数値化は `lib/fraction` で行う。
 */
export type AssignmentInput = components["schemas"]["AssignmentRequestSchema"];
export type AssignmentResult = components["schemas"]["AssignmentRunResponse"];
export type AssignmentEvent = components["schemas"]["AssignmentEventSchema"];
export type AssignmentConstraintEntry =
  components["schemas"]["AssignmentConstraintEntrySchema"];
export type LotteryTerm = components["schemas"]["LotteryTermSchema"];
export type AssignmentReportItem = components["schemas"]["ReportItemSchema"];

/** 未配属（∅）を表す部署 index。 */
export const UNASSIGNED = -1;
