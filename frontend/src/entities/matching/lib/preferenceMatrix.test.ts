import { describe, expect, test } from "vitest";

import type { RankCell, RankMatrix } from "./preferenceMatrix";
import {
  copyRow,
  fillRemaining,
  fillRemainingAll,
  isMatrixValid,
  prefsFromMatrix,
  randomizeMatrix,
  randomRow,
  validateRow,
} from "./preferenceMatrix";

/** テスト用の決定的な一様乱数（線形合同法）。 */
function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function sortedPrefs(row: readonly RankCell[]): number[] {
  return [...(prefsFromMatrix([row])[0] ?? [])].sort((a, b) => a - b);
}

describe("fillRemaining", () => {
  test("入力済みの希望順を保ったまま、未入力の相手を列番号順に末尾へ追加する", () => {
    // 相手3 → 相手1 の順で入力済み、相手2・相手4 が未入力。
    const row: RankCell[] = [2, null, 1, null];
    const filled = fillRemaining(row);
    expect(prefsFromMatrix([filled])).toEqual([[3, 1, 2, 4]]);
    expect(validateRow(filled).isValid).toBe(true);
  });

  test("全セル未入力の行は列番号順の全順位になる", () => {
    expect(prefsFromMatrix([fillRemaining([null, null, null])])).toEqual([[1, 2, 3]]);
  });

  test("入力済みの行は変わらない", () => {
    const row: RankCell[] = [3, 1, 2];
    expect(fillRemaining(row)).toEqual(row);
  });

  test("fillRemainingAll は全行を有効にする（実行ボタンの活性化条件を満たす）", () => {
    const matrix: RankMatrix = [
      [null, null],
      [null, 1],
      [2, 1],
    ];
    expect(isMatrixValid(matrix)).toBe(false);
    expect(isMatrixValid(fillRemainingAll(matrix))).toBe(true);
  });
});

describe("randomRow", () => {
  test.each([1, 2, 5, 12])("列数 %i: 全列を 1 回ずつ含む有効な行になる", (columnCount) => {
    const rng = seededRng(columnCount);
    for (let trial = 0; trial < 20; trial += 1) {
      const row = randomRow(columnCount, rng);
      expect(row).toHaveLength(columnCount);
      expect(validateRow(row).isValid).toBe(true);
      expect(sortedPrefs(row)).toEqual(Array.from({ length: columnCount }, (_, i) => i + 1));
    }
  });

  test("同じ乱数列なら同じ結果になる（乱数生成器を引数で受け取る）", () => {
    expect(randomRow(8, seededRng(42))).toEqual(randomRow(8, seededRng(42)));
  });

  test("乱数が 1 に極端に近い値でも範囲外の列を作らない", () => {
    const row = randomRow(4, () => 0.9999999999);
    expect(sortedPrefs(row)).toEqual([1, 2, 3, 4]);
  });
});

describe("copyRow", () => {
  const matrix: RankMatrix = [
    [1, 2, null],
    [null, null, null],
    [3, 2, 1],
  ];

  test("コピー元の行をコピー先へ複製し、他の行は変えない", () => {
    const next = copyRow(matrix, 2, 1);
    expect(next[1]).toEqual([3, 2, 1]);
    expect(next[0]).toBe(matrix[0]);
    expect(next[2]).toBe(matrix[2]);
  });

  test("範囲外・同一行の指定では元の行列をそのまま返す", () => {
    expect(copyRow(matrix, 5, 0)).toBe(matrix);
    expect(copyRow(matrix, 0, -1)).toBe(matrix);
    expect(copyRow(matrix, 1, 1)).toBe(matrix);
  });
});

describe("randomizeMatrix", () => {
  const matrix: RankMatrix = [
    [null, null, null],
    [null, 1, null],
    [null, null, null],
  ];

  test("empty: 未入力の行だけを有効な順列で埋め、入力途中の行は変えない", () => {
    const next = randomizeMatrix(matrix, seededRng(7), "empty");
    expect(next[1]).toBe(matrix[1]);
    expect(validateRow(next[0] ?? []).isValid).toBe(true);
    expect(validateRow(next[2] ?? []).isValid).toBe(true);
    expect(sortedPrefs(next[0] ?? [])).toEqual([1, 2, 3]);
  });

  test("all: 全行を上書きし、行列全体が有効になる", () => {
    const next = randomizeMatrix(matrix, seededRng(7), "all");
    expect(isMatrixValid(next)).toBe(true);
    next.forEach((row) => expect(sortedPrefs(row)).toEqual([1, 2, 3]));
  });
});
