import { expect, test } from "vitest";

import { findDuplicateNameIndexes, normalizeNamesForSubmit } from "./names";

test("重複がなければ空集合を返す", () => {
  expect(findDuplicateNameIndexes(["営業部", "開発部"])).toEqual(new Set());
});

test("前後の空白を無視して重複を検出する", () => {
  expect(findDuplicateNameIndexes(["営業部", " 営業部 ", "開発部"])).toEqual(new Set([0, 1]));
});

test("空文字は重複判定の対象外", () => {
  expect(findDuplicateNameIndexes(["", "", "開発部"])).toEqual(new Set());
});

test("3件以上の重複もすべて検出する", () => {
  expect(findDuplicateNameIndexes(["A", "A", "A", "B"])).toEqual(new Set([0, 1, 2]));
});

test("全て未入力の場合は null を返す（フィールド省略）", () => {
  expect(normalizeNamesForSubmit(["", "  ", ""])).toBeNull();
});

test("前後の空白を除いた配列を返す", () => {
  expect(normalizeNamesForSubmit([" 営業部 ", "", "開発部"])).toEqual(["営業部", "", "開発部"]);
});
