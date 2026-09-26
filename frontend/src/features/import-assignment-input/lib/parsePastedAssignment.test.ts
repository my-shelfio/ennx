import { describe, expect, test } from "vitest";

import { parsePastedAssignment } from "./parsePastedAssignment";

const limits = { employeeMax: 50, departmentMax: 15 };

describe("parsePastedAssignment", () => {
  test("見出し・名前つきの範囲から規模・名前・希望順位を読み取る（空欄 = 希望しない）", () => {
    const preview = parsePastedAssignment(
      "\t営業\t開発\t人事\r\n田中\t2\t1\t\r\n鈴木\t1\t\t\r\n佐藤\t3\t2\t1\r\n",
      limits,
    );
    expect(preview.tableErrors).toEqual([]);
    expect(preview.rowErrors).toEqual([]);
    expect(preview.pasted).toEqual({
      employeeCount: 3,
      departmentCount: 3,
      departmentNames: ["営業", "開発", "人事"],
      employeeNames: ["田中", "鈴木", "佐藤"],
      agentPrefs: [[2, 1], [1], [3, 2, 1]],
    });
  });

  test("数値だけの範囲は名前なしで規模だけを合わせる（カンマ区切り・全角数字も可）", () => {
    const preview = parsePastedAssignment("１,２\n2,1", limits);
    expect(preview.pasted).toEqual({
      employeeCount: 2,
      departmentCount: 2,
      departmentNames: null,
      employeeNames: null,
      agentPrefs: [
        [1, 2],
        [2, 1],
      ],
    });
  });

  test("順位の重複・列数の不一致は該当行のエラーにし、反映しない", () => {
    const preview = parsePastedAssignment("\t営業\t開発\n田中\t1\t1\n鈴木\t1", limits);
    expect(preview.pasted).toBeNull();
    expect(preview.rowErrors).toEqual([
      { rowIndex: 0, rowName: "田中", message: "順位が重複しています。" },
      { rowIndex: 1, rowName: "鈴木", message: "列数が一致しません（部署2件に対して1列）。" },
    ]);
  });

  test("上限超過・名前の重複は表全体のエラーにする", () => {
    const tooMany = Array.from({ length: 3 }, () => "1").join("\n");
    expect(parsePastedAssignment(tooMany, { employeeMax: 2, departmentMax: 15 }).tableErrors).toEqual(
      ["社員数が上限（2人）を超えています（3行）。"],
    );
    expect(parsePastedAssignment("\t営業\t営業\n田中\t1\t2", limits).tableErrors).toEqual([
      "部署名が重複しています（営業）。",
    ]);
  });

  test("空の貼り付けはエラーにする", () => {
    expect(parsePastedAssignment(" \n", limits)).toMatchObject({
      tableErrors: ["貼り付けた内容に行がありません。"],
      pasted: null,
    });
  });
});
