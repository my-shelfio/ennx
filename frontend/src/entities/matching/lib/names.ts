/**
 * 表示名の解決。
 * `employee_names` / `department_names` は省略可能（MatchingRequestSchema）。
 * 未設定（フィールド自体が省略、または該当インデックスが空白のみ）の場合は
 * 「社員1」「部署1」のような連番ラベルを生成する。
 * 空白のみの要素も「未設定」として扱うのは、設定ウィザードの「名前」ステップ
 * （widgets/setup-wizard）が、規模変更時の resizeArray 追従・行単位の入力状態保持のため
 * 未入力欄を空文字のまま `MatchingInput.department_names` / `employee_names` へ保存する
 * ことがあるため（フィールド全体を省略できるのは「全欄が未入力」の場合のみ）。
 *
 * widgets/preference-matrix（行列エディタの見出し）・widgets/setup-wizard（詳細ステップの
 * 定員ラベル）・pages/preferences（CSV再取込時に現在の名前一覧を求める）が使うため
 * entities 層に置く。
 */
export function resolveNames(
  names: readonly string[] | null | undefined,
  count: number,
  prefix: string,
): string[] {
  return Array.from({ length: count }, (_, index) => {
    const name = names?.[index];
    return name !== undefined && name.trim() !== "" ? name : `${prefix}${index + 1}`;
  });
}
