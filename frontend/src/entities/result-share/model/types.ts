import type { components } from "../../../shared/api";

/**
 * 結果共有（閲覧用 URL）関連の型。
 * バックエンドの OpenAPI スキーマ（`shared/api`）から直接導出し、二重定義を避ける。
 */
export type ResultShareCreateRequest = components["schemas"]["ResultShareCreateSchema"];
export type ResultShareCreated = components["schemas"]["ResultShareCreatedSchema"];
export type SharedResult = components["schemas"]["SharedResultSchema"];
