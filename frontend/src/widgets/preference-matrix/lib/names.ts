/**
 * @deprecated 表示名の解決ロジックは entities/matching/lib/names.ts へ移設した
 * （features/import-input の CSV 取込プレビューと同じロジックを共有するため）。
 * このファイルは既存 import の互換のため re-export のみを行う。新規のインポート元には
 * `entities/matching` を直接使うこと。
 */
export { resolveNames } from "../../../entities/matching";
