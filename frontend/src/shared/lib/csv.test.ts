import { describe, expect, it } from "vitest";

import { escapeCsvField, parseCsv, stripBom, toCsvRow, UTF8_BOM } from "./csv";

describe("stripBom", () => {
  it("先頭のUTF-8 BOMを除去する", () => {
    expect(stripBom(`${UTF8_BOM}a,b`)).toBe("a,b");
  });

  it("BOMが無ければそのまま返す", () => {
    expect(stripBom("a,b")).toBe("a,b");
  });
});

describe("escapeCsvField / toCsvRow", () => {
  it("カンマ・改行・ダブルクォートを含む場合のみ引用符で囲む", () => {
    expect(escapeCsvField("plain")).toBe("plain");
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField("a\nb")).toBe('"a\nb"');
    expect(escapeCsvField('a"b')).toBe('"a""b"');
  });

  it("行全体を組み立てる", () => {
    expect(toCsvRow(["部署名", "定員"])).toBe("部署名,定員");
    expect(toCsvRow(["営業,企画", "10"])).toBe('"営業,企画",10');
  });
});

describe("parseCsv", () => {
  it("単純なCSVを行×列にパースする", () => {
    expect(parseCsv("部署名,定員\n営業,10\n企画,5")).toEqual([
      ["部署名", "定員"],
      ["営業", "10"],
      ["企画", "5"],
    ]);
  });

  it("先頭のBOMを除去してからパースする", () => {
    expect(parseCsv(`${UTF8_BOM}部署名,定員\n営業,10`)).toEqual([
      ["部署名", "定員"],
      ["営業", "10"],
    ]);
  });

  it("CRLF改行を扱える", () => {
    expect(parseCsv("部署名,定員\r\n営業,10\r\n")).toEqual([
      ["部署名", "定員"],
      ["営業", "10"],
    ]);
  });

  it("CR単独の改行も扱える", () => {
    expect(parseCsv("部署名,定員\r営業,10")).toEqual([
      ["部署名", "定員"],
      ["営業", "10"],
    ]);
  });

  it("ダブルクォートで囲まれたフィールド内のカンマ・改行・エスケープされた\"\"を扱える", () => {
    expect(parseCsv('a,"b,c",d\ne,"f\ng","h""i"')).toEqual([
      ["a", "b,c", "d"],
      ["e", "f\ng", 'h"i'],
    ]);
  });

  it("全セルが空文字の行（空行）は除外する", () => {
    expect(parseCsv("a,b\n\n\nc,d\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("エスケープしてから戻すと元のグリッドに一致する（往復）", () => {
    const grid = [
      ["部署名", "定員"],
      ["営業,企画", '10"名'],
      ["開発\n部", "5"],
    ];
    const csvText = grid.map((row) => toCsvRow(row)).join("\r\n");
    expect(parseCsv(csvText)).toEqual(grid);
  });
});
