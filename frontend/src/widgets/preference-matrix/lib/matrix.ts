/**
 * @deprecated 選好行列 ⇔ 選好リスト変換・行検証ロジックは entities/matching/lib/preferenceMatrix.ts へ
 * 移設した（#123: features/import-input の CSV 順位検証と同じロジックを共有するため）。
 * このファイルは既存 import の互換のため re-export のみを行う。新規のインポート元には
 * `entities/matching` を直接使うこと。
 */
export {
  createEmptyMatrix,
  isMatrixValid,
  matrixFromPrefs,
  prefsFromMatrix,
  updateCell,
  validateRow,
} from "../../../entities/matching";
export type { RankCell, RankMatrix, RowValidation } from "../../../entities/matching";
