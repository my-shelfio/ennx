import { parseCsv } from "./csv";

/**
 * 表計算ソフト（Excel・Google スプレッドシート等）からコピーした範囲の貼り付けを解釈する
 * ユーティリティ。
 *
 * 範囲をコピーするとクリップボードにはタブ区切り（TSV）のテキストが入る。CSV ファイルを
 * テキストエディタで開いて貼り付けた場合はカンマ区切りになるため、区切り文字は自動判定する
 * （タブを 1 つでも含めばタブ区切り、含まなければカンマ区切り）。
 * 引用符・セル内改行の扱いは CSV パーサ（RFC4180 準拠の簡易実装）と共通。
 *
 * 選好（希望順位）の貼り付けは「行 = 順位をつける人、列 = 相手、セル = 希望順位」の形とし、
 * 1 行目・1 列目が名前（見出し）かどうかは「数値として読めない値があるか」で判定する。
 * 配属マッチング・割り当ての双方の取込で共用するため shared 層に置く。
 */

/** 貼り付けテキストの区切り文字を判定する（タブ優先）。 */
export function detectDelimiter(text: string): "\t" | "," {
  return text.includes("\t") ? "\t" : ",";
}

/** 貼り付けテキストを行 × 列の文字列グリッドへ変換する（区切り文字は自動判定）。 */
export function parseDelimitedText(text: string): string[][] {
  return parseCsv(text, detectDelimiter(text));
}

/**
 * セルの文字列を希望順位として読む。全角数字・前後の空白を許容する。
 * 空欄は null、1 以上の整数として読めない値は undefined（不正な値）を返す。
 */
export function parseRankCell(raw: string): number | null | undefined {
  const normalized = raw.normalize("NFKC").trim();
  if (normalized === "") {
    return null;
  }
  if (!/^\d+$/.test(normalized)) {
    return undefined;
  }
  const value = Number(normalized);
  return value >= 1 ? value : undefined;
}

function isNameLike(raw: string | undefined): boolean {
  if (raw === undefined) {
    return false;
  }
  return raw.trim() !== "" && parseRankCell(raw) === undefined;
}

/** 貼り付けた表の 1 セル分の解釈結果。 */
export type PastedRankCell =
  | { kind: "empty" }
  | { kind: "rank"; value: number }
  | { kind: "invalid"; raw: string };

export interface PastedRankTable {
  /** 1 行目が見出し（相手の名前）だった場合の名前一覧。見出しが無ければ null。 */
  columnNames: string[] | null;
  /** 1 列目が名前（順位をつける人の名前）だった場合の名前一覧。名前列が無ければ null。 */
  rowNames: string[] | null;
  /** 見出し・名前列を除いた各行のセル（行ごとに長さが異なりうる）。 */
  rows: PastedRankCell[][];
}

function toRankCell(raw: string): PastedRankCell {
  const parsed = parseRankCell(raw);
  if (parsed === null) {
    return { kind: "empty" };
  }
  if (parsed === undefined) {
    return { kind: "invalid", raw: raw.trim() };
  }
  return { kind: "rank", value: parsed };
}

/**
 * 貼り付けテキストを希望順位の表として解釈する。
 * - 1 行目の 2 列目以降（1 列しか無い場合は 1 列目）に数値でない値があれば、1 行目を見出しとする
 * - 見出しを除いた行の 1 列目に数値でない値が 1 つでもあれば、1 列目を名前列とする
 * 見出し行があり名前列もある場合、見出しの 1 列目（左上のセル）は無視する。
 */
export function parsePastedRankTable(text: string): PastedRankTable {
  const grid = parseDelimitedText(text);
  if (grid.length === 0) {
    return { columnNames: null, rowNames: null, rows: [] };
  }

  const firstRow = grid[0] ?? [];
  const hasHeaderRow =
    firstRow.length === 1 ? isNameLike(firstRow[0]) : firstRow.slice(1).some(isNameLike);
  const dataGrid = hasHeaderRow ? grid.slice(1) : grid;
  const hasNameColumn = dataGrid.some((row) => isNameLike(row[0]));

  const columnNames = hasHeaderRow
    ? (hasNameColumn ? firstRow.slice(1) : firstRow).map((name) => name.trim())
    : null;

  return {
    columnNames,
    rowNames: hasNameColumn ? dataGrid.map((row) => (row[0] ?? "").trim()) : null,
    rows: dataGrid.map((row) => (hasNameColumn ? row.slice(1) : row).map(toRankCell)),
  };
}

/**
 * 1 行分のセル（列 = 相手、値 = 希望順位）を、希望順に並べた 1-indexed の相手番号リストへ
 * 変換する。順位の重複・抜け（1 から連続していない）・不正な値・未入力の行はエラーにする。
 */
export function rankCellsToPrefs(
  cells: readonly PastedRankCell[],
): { prefs: number[] } | { error: string } {
  const invalid = cells.find((cell) => cell.kind === "invalid");
  if (invalid !== undefined && invalid.kind === "invalid") {
    return { error: `順位は1以上の整数で入力してください（現在の値: "${invalid.raw}"）。` };
  }
  const ranked = cells
    .map((cell, columnIndex) => ({ cell, counterpart: columnIndex + 1 }))
    .filter(
      (entry): entry is { cell: { kind: "rank"; value: number }; counterpart: number } =>
        entry.cell.kind === "rank",
    )
    .sort((a, b) => a.cell.value - b.cell.value);
  if (ranked.length === 0) {
    return { error: "少なくとも1件の希望順位を入力してください。" };
  }
  const duplicated = ranked.some(
    (entry, index) => index > 0 && ranked[index - 1]?.cell.value === entry.cell.value,
  );
  if (duplicated) {
    return { error: "順位が重複しています。" };
  }
  if (!ranked.every((entry, index) => entry.cell.value === index + 1)) {
    return { error: "順位は1から連続した整数で入力してください（抜けがあります）。" };
  }
  return { prefs: ranked.map((entry) => entry.counterpart) };
}
