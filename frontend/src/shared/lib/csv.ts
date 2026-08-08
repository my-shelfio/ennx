/**
 * CSV の共通ユーティリティ。
 *
 * features/export-result（結果CSVエクスポート）・features/import-input
 * （CSV一括インポート・テンプレート配布）の双方が同じエスケープ・BOM・パース処理を
 * 必要とするため、shared 層に置く（FSD 層依存規則上、features 同士は互いに
 * import できないため）。Excel 互換のため UTF-8 BOM 付与・CRLF 改行を前提とする。
 */

/** Excel等でCSVを開いた際の文字化けを避けるための UTF-8 BOM。 */
export const UTF8_BOM = "﻿";

/** 文字列先頭の UTF-8 BOM を除去する（読み込んだCSVファイルの内容に対して使う）。 */
export function stripBom(text: string): string {
  return text.length > 0 && text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** CSVフィールドをエスケープする（カンマ・ダブルクォート・改行を含む場合のみ引用符で囲む）。 */
export function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** CSVの1行分の文字列を組み立てる。 */
export function toCsvRow(fields: readonly string[]): string {
  return fields.map(escapeCsvField).join(",");
}

/**
 * CSV テキストを行×列の文字列グリッドへパースする（RFC4180準拠の簡易実装）。
 * - ダブルクォートで囲まれたフィールド内のカンマ・改行・エスケープされた `""` に対応する。
 * - 改行は `\r\n` / `\n` / `\r` のいずれも行区切りとして扱う。
 * - 先頭の UTF-8 BOM は除去する。
 * - 全セルが空文字の行（空行）は結果から除外する。
 */
export function parseCsv(text: string): string[][] {
  const source = stripBom(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      index += 1;
      continue;
    }

    if (char === "\r" || char === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      index += char === "\r" && source[index + 1] === "\n" ? 2 : 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}
