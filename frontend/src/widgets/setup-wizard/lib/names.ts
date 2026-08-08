/**
 * ステップ「名前」（社員名・部署名）のインライン検証。
 * 名前は省略可能（未入力は resolveNames のデフォルト名にフォールバックする）。
 * 重複は入力を妨げない警告に留める（`capacities` の合計警告と同様、続行可能な警告として扱う）。
 * すべて純粋関数とし、フォーム状態から独立してテストできるようにする。
 */

/**
 * 名前一覧のうち、前後の空白を除いた上で重複している（かつ空文字ではない）要素の
 * インデックス集合を返す。
 */
export function findDuplicateNameIndexes(names: readonly string[]): ReadonlySet<number> {
  const indexesByTrimmed = new Map<string, number[]>();
  names.forEach((name, index) => {
    const trimmed = name.trim();
    if (trimmed === "") {
      return;
    }
    const indexes = indexesByTrimmed.get(trimmed) ?? [];
    indexes.push(index);
    indexesByTrimmed.set(trimmed, indexes);
  });

  const duplicates = new Set<number>();
  for (const indexes of indexesByTrimmed.values()) {
    if (indexes.length > 1) {
      indexes.forEach((index) => duplicates.add(index));
    }
  }
  return duplicates;
}

/**
 * 送信用に名前一覧を正規化する。前後の空白を除いた結果が空文字の要素は
 * 「未入力」として扱う（resolveNames のデフォルト名フォールバックに委ねるため null を返す）。
 * 全要素が未入力の場合は、フィールド自体を省略できるよう null を返す。
 */
export function normalizeNamesForSubmit(names: readonly string[]): string[] | null {
  const trimmed = names.map((name) => name.trim());
  if (trimmed.every((name) => name === "")) {
    return null;
  }
  return trimmed;
}
