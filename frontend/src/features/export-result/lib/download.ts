/**
 * @deprecated ファイルダウンロード処理は shared/lib/download.ts へ移設した
 * （features/import-input のテンプレートCSV配布と共有するため。features 同士は
 * 互いに import できないため shared 層に置く）。このファイルは既存 import の互換のため
 * re-export のみを行う。新規のインポート元には `shared/lib` を直接使うこと。
 */
export { downloadFile } from "../../../shared/lib";
