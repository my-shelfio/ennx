import { describe, expect, test } from "vitest";

import {
  detectDelimiter,
  parseDelimitedText,
  parsePastedRankTable,
  parseRankCell,
  rankCellsToPrefs,
} from "./pastedTable";
import type { PastedRankCell } from "./pastedTable";

const rank = (value: number): PastedRankCell => ({ kind: "rank", value });
const empty: PastedRankCell = { kind: "empty" };

describe("detectDelimiter / parseDelimitedText", () => {
  test("タブを含めばタブ区切り（Excel の範囲コピー）として読む", () => {
    const text = "\t営業\t開発\r\n田中\t1\t2\r\n";
    expect(detectDelimiter(text)).toBe("\t");
    expect(parseDelimitedText(text)).toEqual([
      ["", "営業", "開発"],
      ["田中", "1", "2"],
    ]);
  });

  test("タブを含まなければカンマ区切りとして読む", () => {
    const text = "1,2\n2,1";
    expect(detectDelimiter(text)).toBe(",");
    expect(parseDelimitedText(text)).toEqual([
      ["1", "2"],
      ["2", "1"],
    ]);
  });

  test("末尾の改行・空行は無視する", () => {
    expect(parseDelimitedText("1\t2\n\n2\t1\n\n")).toEqual([
      ["1", "2"],
      ["2", "1"],
    ]);
  });

  test("タブ区切りでもセル内のカンマは区切りとして扱わない", () => {
    expect(parseDelimitedText("営業,東京\t開発\n1\t2")).toEqual([
      ["営業,東京", "開発"],
      ["1", "2"],
    ]);
  });
});

describe("parseRankCell", () => {
  test.each<[string, number | null | undefined]>([
    ["1", 1],
    [" 12 ", 12],
    ["３", 3],
    ["１０", 10],
    ["", null],
    ["  ", null],
    ["0", undefined],
    ["1.5", undefined],
    ["-1", undefined],
    ["a", undefined],
  ])("%j → %s", (raw, expected) => {
    expect(parseRankCell(raw)).toBe(expected);
  });
});

describe("parsePastedRankTable", () => {
  test("見出し行・名前列ありの表を読む（左上のセルは無視する）", () => {
    const table = parsePastedRankTable("社員\t営業\t開発\n田中\t2\t1\n鈴木\t1\t\n");
    expect(table.columnNames).toEqual(["営業", "開発"]);
    expect(table.rowNames).toEqual(["田中", "鈴木"]);
    expect(table.rows).toEqual([
      [rank(2), rank(1)],
      [rank(1), empty],
    ]);
  });

  test("数値だけの範囲は見出し・名前列なしとして読む", () => {
    const table = parsePastedRankTable("1\t2\n2\t1");
    expect(table.columnNames).toBeNull();
    expect(table.rowNames).toBeNull();
    expect(table.rows).toHaveLength(2);
  });

  test("名前列だけがある（見出し行なし）範囲を読む", () => {
    const table = parsePastedRankTable("田中\t1\t2\n鈴木\t2\t1");
    expect(table.columnNames).toBeNull();
    expect(table.rowNames).toEqual(["田中", "鈴木"]);
    expect(table.rows[0]).toEqual([rank(1), rank(2)]);
  });

  test("見出し行だけがある（名前列なし）範囲を読む", () => {
    const table = parsePastedRankTable("営業,開発\n1,2");
    expect(table.columnNames).toEqual(["営業", "開発"]);
    expect(table.rowNames).toBeNull();
    expect(table.rows).toEqual([[rank(1), rank(2)]]);
  });

  test("全角数字の順位を読み、数値でない順位は不正な値として残す", () => {
    const table = parsePastedRankTable("１\t２\n2\tx");
    expect(table.columnNames).toBeNull();
    expect(table.rowNames).toBeNull();
    expect(table.rows).toEqual([
      [rank(1), rank(2)],
      [rank(2), { kind: "invalid", raw: "x" }],
    ]);
  });

  test("空の貼り付けは空の表になる", () => {
    expect(parsePastedRankTable("\n\n")).toEqual({ columnNames: null, rowNames: null, rows: [] });
  });
});

describe("rankCellsToPrefs", () => {
  test("順位を希望順の 1-indexed 相手番号リストへ変換する（空欄は受け入れ不可）", () => {
    expect(rankCellsToPrefs([rank(2), empty, rank(1)])).toEqual({ prefs: [3, 1] });
  });

  test.each<[string, PastedRankCell[], string]>([
    ["重複", [rank(1), rank(1)], "順位が重複しています。"],
    ["抜け", [rank(1), rank(3)], "順位は1から連続した整数で入力してください（抜けがあります）。"],
    ["未入力", [empty, empty], "少なくとも1件の希望順位を入力してください。"],
    [
      "不正な値",
      [rank(1), { kind: "invalid", raw: "x" }],
      '順位は1以上の整数で入力してください（現在の値: "x"）。',
    ],
  ])("%s はエラーにする", (_label, cells, message) => {
    expect(rankCellsToPrefs(cells)).toEqual({ error: message });
  });
});
