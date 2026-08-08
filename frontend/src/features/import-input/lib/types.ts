/**
 * CSV一括インポートの型定義。
 *
 * テンプレート3ファイル構成（#123）:
 * - settings.csv: 部署名・定員（行=部署: `部署名,定員`）
 * - employee_prefs.csv: 社員→部署の選好行列（行=社員、列=部署、セル=希望順位1〜）
 * - department_prefs.csv: 部署→社員の優先順位行列（行=部署、列=社員、セル=優先順位1〜）
 */
export type ImportFileRole = "settings" | "employee_prefs" | "department_prefs";

/** ファイル名（小文字化して比較）→ 役割。テンプレートのファイル名と一致させる。 */
export const IMPORT_FILE_NAMES: Record<ImportFileRole, string> = {
  settings: "settings.csv",
  employee_prefs: "employee_prefs.csv",
  department_prefs: "department_prefs.csv",
};

/** インポート対象として選択された生のCSVファイル（パース前）。 */
export interface RawImportFile {
  fileName: string;
  text: string;
}

/**
 * 取込内容の検証結果 1 件。
 * `blocking: true` はストア反映（確定）をブロックする重大なエラー
 * （必須ファイル不足・上限超過・部署/社員名の不整合・ファイル形式不正）。
 * `blocking: false` は行列の順位エラー（重複・範囲外・空欄）で、取り込み自体は
 * ブロックせず、行列UI上で修正できるようにする（#123 の要件）。
 */
export interface ImportIssue {
  blocking: boolean;
  message: string;
}

/** CSV一括インポートのプレビュー結果。 */
export interface ImportPreview {
  /** 認識できたファイルの役割一覧。 */
  recognizedRoles: ImportFileRole[];
  /** 役割を認識できなかったファイル名一覧（settings.csv 等のファイル名と不一致）。 */
  unrecognizedFileNames: string[];
  /** 部署名一覧（settings.csv または employee_prefs.csv のヘッダーから取得）。取得できない場合は null。 */
  departmentNames: string[] | null;
  /** 社員名一覧（employee_prefs.csv または department_prefs.csv のヘッダーから取得）。取得できない場合は null。 */
  employeeNames: string[] | null;
  /** 部署ごとの定員（settings.csv 由来）。settings.csv が対象外/未選択の場合は null。 */
  capacities: number[] | null;
  /** 社員→部署の選好リスト（employee_prefs.csv 由来）。取得できない場合は null。 */
  proposerPrefs: number[][] | null;
  /** 部署→社員の優先順位リスト（department_prefs.csv 由来）。取得できない場合は null。 */
  receiverPrefs: number[][] | null;
  /** 検証結果一覧（行・列を特定した日本語メッセージ）。 */
  issues: ImportIssue[];
  /** true の場合、確定（ストア反映）を実行できる（blocking な issue が無く、必須ファイルが揃っている）。 */
  canConfirm: boolean;
}
