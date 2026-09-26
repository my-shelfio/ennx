import { describe, expect, test } from "vitest";

import { parsePastedMatrix } from "./parsePastedMatrix";

const options = {
  rowLabel: "社員",
  columnLabel: "部署",
  expectedRowNames: ["田中", "鈴木"],
  expectedColumnNames: ["営業", "開発", "人事"],
};

describe("parsePastedMatrix", () => {
  test("Excel の範囲（見出し・名前つきのタブ区切り）を選好リストへ変換する", () => {
    const preview = parsePastedMatrix(
      "\t営業\t開発\t人事\r\n田中\t2\t1\t3\r\n鈴木\t1\t\t\r\n",
      options,
    );
    expect(preview.tableErrors).toEqual([]);
    expect(preview.rowErrors).toEqual([]);
    expect(preview.prefs).toEqual([[2, 1, 3], [1]]);
    expect(preview.rowCount).toBe(2);
    expect(preview.columnCount).toBe(3);
  });

  test("数値だけの範囲は現在の並び順どおりに読む（全角数字も可）", () => {
    const preview = parsePastedMatrix("１\t２\t３\n3\t2\t1", options);
    expect(preview.prefs).toEqual([
      [1, 2, 3],
      [3, 2, 1],
    ]);
  });

  test("順位の重複・列数の不一致は該当行のエラーとし、反映しない", () => {
    const preview = parsePastedMatrix("1\t1\t2\n1\t2", options);
    expect(preview.prefs).toBeNull();
    expect(preview.rowErrors).toEqual([
      { rowIndex: 0, rowName: "田中", message: "順位が重複しています。" },
      {
        rowIndex: 1,
        rowName: "鈴木",
        message: "列数が一致しません（部署3件に対して2列）。",
      },
    ]);
  });

  test("行数・見出しの名前が現在の設定と一致しない場合は表全体のエラーにする", () => {
    expect(parsePastedMatrix("1\t2\t3", options).tableErrors).toEqual([
      "社員数が一致しません（現在: 2件、貼り付け: 1行）。",
    ]);
    expect(
      parsePastedMatrix("\t営業\t総務\t人事\n田中\t1\t2\t3\n鈴木\t1\t2\t3", options).tableErrors,
    ).toEqual(['2番目の部署名が現在の設定と一致しません（現在: "開発"、貼り付け: "総務"）。']);
    expect(
      parsePastedMatrix("\t営業\t開発\n田中\t1\t2\n鈴木\t1\t2", options).tableErrors,
    ).toEqual(["見出しの部署数が一致しません（現在: 3件、貼り付け: 2列）。"]);
  });

  test("空の貼り付けはエラーにする", () => {
    expect(parsePastedMatrix("", options)).toMatchObject({
      tableErrors: ["貼り付けた内容に行がありません。"],
      prefs: null,
    });
  });
});
