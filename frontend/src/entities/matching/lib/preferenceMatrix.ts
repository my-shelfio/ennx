/**
 * 選好行列 ⇔ 選好リスト（1-indexed）の変換と行検証。
 *
 * 行列のセル値は「相手への希望順位」（1 始まりの整数）。未入力は null。
 * バックエンド（MatchingRequestSchema.proposer_prefs / receiver_prefs）は
 * 「希望順に並べた 1-indexed の相手番号リスト」であり、リストに含まれない
 * 相手は「受け入れ不可能」を意味する（部分的な選好で足りる。
 * backend/src/domain/matching/models.py の BaseMatchingInput 参照）。
 * そのため行の必須条件は「重複がない」「入力済みの順位が 1 から連続している」の
 * 2 点のみとし、全列を埋める必要はない。
 *
 * widgets/preference-matrix（行列エディタ）・features/import-input（CSV一括インポートの
 * 順位検証・行列UIとの整合）の双方が同じ変換・検証ロジックを必要とするため entities 層に
 * 置く（FSD 層依存規則上、features は widgets に依存できない。entities は双方の下位層のため
 * 両立できる。features/export-result の buildCsvExport.ts と同様の配置理由）。
 *
 * UI 状態から独立した純粋関数として実装し、vitest で単体テストする。
 */

export type RankCell = number | null;
export type RankMatrix = readonly (readonly RankCell[])[];

/** rowCount 行 × columnCount 列の空行列（全セル未入力）を作る。 */
export function createEmptyMatrix(rowCount: number, columnCount: number): RankMatrix {
  return Array.from({ length: rowCount }, () =>
    Array.from({ length: columnCount }, (): RankCell => null),
  );
}

/**
 * 選好リスト（1-indexed の相手番号を希望順に並べたもの）から行列へ変換する。
 * 例: prefs = [3, 1, 2], columnCount = 3
 *   → 列0（相手1）は順位2、列1（相手2）は順位3、列2（相手3）は順位1。
 * 範囲外の相手番号（1〜columnCount 外）は無視する（表示上は捨てるが、
 * 実際の入力はこの行列エディタ経由でのみ生成されるため通常は発生しない）。
 */
export function matrixFromPrefs(
  prefs: readonly (readonly number[])[],
  columnCount: number,
): RankMatrix {
  return prefs.map((row) => {
    const cells: RankCell[] = Array.from({ length: columnCount }, (): RankCell => null);
    row.forEach((counterpart, orderIndex) => {
      const columnIndex = counterpart - 1;
      if (columnIndex >= 0 && columnIndex < columnCount) {
        cells[columnIndex] = orderIndex + 1;
      }
    });
    return cells;
  });
}

/**
 * 行列から選好リスト（1-indexed、希望順位の昇順）へ変換する。
 * 行が無効（重複・順位の抜け）な場合でも、順位でソートした結果をそのまま返す
 * （活性化条件の判定は isMatrixValid / validateRow が別途担う）。
 * 順位が重複している場合は、同順位内では列の並び順（Array.prototype.sort の安定ソート）で
 * タイブレークする（CSV一括インポートで重複順位を含む行を取り込んだ場合のフォールバック）。
 */
export function prefsFromMatrix(matrix: RankMatrix): number[][] {
  return matrix.map((row) => {
    const ranked = row
      .map((rank, columnIndex) => ({ rank, counterpart: columnIndex + 1 }))
      .filter(
        (entry): entry is { rank: number; counterpart: number } => entry.rank !== null,
      )
      .sort((a, b) => a.rank - b.rank);
    return ranked.map((entry) => entry.counterpart);
  });
}

export interface RowValidation {
  /** 重複した順位が入力されている列インデックスの集合。 */
  duplicateColumns: ReadonlySet<number>;
  /** 順位に抜けがある・未入力の場合のエラーメッセージ（重複エラー時は算出しない）。 */
  continuityError?: string;
  /** 行全体が有効か（重複なし・1件以上入力済み・1から連続）。 */
  isValid: boolean;
}

/** 1 行分の選好入力を検証する（順位の重複・連続性のリアルタイム検証）。 */
export function validateRow(row: readonly RankCell[]): RowValidation {
  const rankToColumns = new Map<number, number[]>();
  row.forEach((rank, columnIndex) => {
    if (rank === null) {
      return;
    }
    const columns = rankToColumns.get(rank) ?? [];
    columns.push(columnIndex);
    rankToColumns.set(rank, columns);
  });

  const duplicateColumns = new Set<number>();
  for (const columns of rankToColumns.values()) {
    if (columns.length > 1) {
      columns.forEach((columnIndex) => duplicateColumns.add(columnIndex));
    }
  }

  if (duplicateColumns.size > 0) {
    return { duplicateColumns, isValid: false };
  }

  const filledRanks = [...rankToColumns.keys()].sort((a, b) => a - b);
  if (filledRanks.length === 0) {
    return {
      duplicateColumns,
      continuityError: "少なくとも1件の希望順位を入力してください。",
      isValid: false,
    };
  }

  const isContiguousFromOne = filledRanks.every((rank, index) => rank === index + 1);
  if (!isContiguousFromOne) {
    return {
      duplicateColumns,
      continuityError: "順位は1から連続した整数で入力してください（抜けがあります）。",
      isValid: false,
    };
  }

  return { duplicateColumns, isValid: true };
}

/** 行列の全行が有効かどうか（実行ボタンの活性化条件）。 */
export function isMatrixValid(matrix: RankMatrix): boolean {
  return matrix.length > 0 && matrix.every((row) => validateRow(row).isValid);
}

/**
 * 行列の1セルを更新した新しい行列を返す（イミュータブル）。
 * value が null の場合はセルをクリアする。
 */
export function updateCell(
  matrix: RankMatrix,
  rowIndex: number,
  columnIndex: number,
  value: RankCell,
): RankMatrix {
  return matrix.map((row, r) => {
    if (r !== rowIndex) {
      return row;
    }
    return row.map((cell, c) => (c === columnIndex ? value : cell));
  });
}

/**
 * 行（1人・1部署分の選好）のうち入力済みのセルのみを、順位の昇順（好みの高い順）で
 * 列インデックスの配列に変換する。同順位はタイブレークとして列の並び順を使う
 * （prefsFromMatrix と同じ規則）。未入力セルは含めない点が rowFromOrderedColumns の
 * 逆変換と対になる（プルダウン入力 UI の PreferencePulldownRow が、行の現在の選択状態を
 * 「第1希望・第2希望…」のプルダウン列へ復元するために使う）。
 */
export function filledColumnsInRankOrder(row: readonly RankCell[]): number[] {
  return row
    .map((rank, columnIndex) => ({ rank, columnIndex }))
    .filter((entry): entry is { rank: number; columnIndex: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.columnIndex - b.columnIndex)
    .map((entry) => entry.columnIndex);
}

/**
 * 順位昇順に並べた列インデックスの配列（重複なし、columnCount 件に満たない部分列でも可）を
 * 行に変換する。範囲外の列インデックスは無視する（matrixFromPrefs と同じ防御）。
 * プルダウン入力 UI は「第k希望」の選択・追加・削除のたびに、その時点で選択済みの列を
 * 順番に並べたこの形式で行全体を組み直すため、結果は常に 1 から連続した順位になる
 * （重複・抜けが構造的に発生しない）。
 */
export function rowFromOrderedColumns(
  orderedColumns: readonly number[],
  columnCount: number,
): RankCell[] {
  const row: RankCell[] = new Array(columnCount).fill(null);
  orderedColumns.forEach((columnIndex, position) => {
    if (columnIndex >= 0 && columnIndex < columnCount) {
      row[columnIndex] = position + 1;
    }
  });
  return row;
}

/** 行列の1行を新しい行で置き換えた新しい行列を返す（イミュータブル）。 */
export function updateRow(
  matrix: RankMatrix,
  rowIndex: number,
  row: readonly RankCell[],
): RankMatrix {
  return matrix.map((existingRow, r) => (r === rowIndex ? row : existingRow));
}
