import type { KeyboardEvent } from "react";

/**
 * 選好行列のプルダウン間を矢印キーで移動するためのヘルパー。
 *
 * 各プルダウン（select）に data 属性でグリッド名・行・列（希望順位の位置）を持たせ、
 * 矢印キーで同じグリッド内の隣のプルダウンへフォーカスを移す。
 * - 左右: 同じ行の前後の希望順位へ移動する
 * - 上下: 前後の行の同じ希望順位へ移動する（その行のプルダウンが少ない場合は末尾へ）
 *
 * ブラウザ標準では、閉じた select 上の矢印キーは選択値の変更（Windows 等）や
 * 一覧の展開（macOS）に使われる。この行列では選択の変更が即座に保存されるため、
 * 矢印キーは修飾キーなしの場合は常に移動に割り当て、標準動作を抑止する
 * （値の選択は Space / Enter で一覧を開いて行う）。
 */

const GRID_ATTR = "data-pref-grid";
const ROW_ATTR = "data-pref-row";
const COL_ATTR = "data-pref-col";

export interface GridCellAttributes {
  "data-pref-grid": string;
  "data-pref-row": number;
  "data-pref-col": number;
}

/** プルダウンに付与する data 属性を返す。 */
export function gridCellAttributes(grid: string, row: number, col: number): GridCellAttributes {
  return { [GRID_ATTR]: grid, [ROW_ATTR]: row, [COL_ATTR]: col } as GridCellAttributes;
}

function cellsInRow(grid: string, row: number): HTMLElement[] {
  const selector = `[${GRID_ATTR}="${CSS.escape(grid)}"][${ROW_ATTR}="${row}"]`;
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).sort(
    (a, b) => Number(a.getAttribute(COL_ATTR)) - Number(b.getAttribute(COL_ATTR)),
  );
}

function isPlainArrowKey(event: KeyboardEvent<HTMLElement>): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return false;
  }
  const { key } = event;
  return key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown";
}

/**
 * グリッド外の、選択が即座に反映される select（例: 行のコピー元の選択）の onKeyDown に渡す
 * ハンドラ。修飾キーなしの矢印キーによる選択値の変更だけを抑止する（フォーカス移動はしない）。
 * 行列の他のプルダウンと同じく、値の選択は Space / Enter で一覧を開いて行う。
 */
export function suppressArrowKeySelection(event: KeyboardEvent<HTMLElement>): void {
  if (isPlainArrowKey(event)) {
    event.preventDefault();
  }
}

/** select の onKeyDown に渡すハンドラ。矢印キーでグリッド内の隣のプルダウンへ移動する。 */
export function handleGridKeyDown(event: KeyboardEvent<HTMLElement>): void {
  if (!isPlainArrowKey(event)) {
    return;
  }
  const { key } = event;
  const element = event.currentTarget;
  const grid = element.getAttribute(GRID_ATTR);
  const row = Number(element.getAttribute(ROW_ATTR));
  const col = Number(element.getAttribute(COL_ATTR));
  if (grid === null || !Number.isInteger(row) || !Number.isInteger(col)) {
    return;
  }

  event.preventDefault();

  const targetRow = key === "ArrowUp" ? row - 1 : key === "ArrowDown" ? row + 1 : row;
  const targetCol = key === "ArrowLeft" ? col - 1 : key === "ArrowRight" ? col + 1 : col;
  const candidates = cellsInRow(grid, targetRow);
  if (candidates.length === 0 || targetCol < 0) {
    return;
  }
  const target =
    candidates.find((cell) => Number(cell.getAttribute(COL_ATTR)) === targetCol) ??
    (targetRow !== row ? candidates[candidates.length - 1] : undefined);
  target?.focus();
}

/**
 * グリッド内の指定行の先頭のプルダウンへフォーカスを移す。
 * 操作したボタンが直後に無効化される場合（例: 行の自動補完で行が埋まった）に、
 * キーボードのフォーカス位置を失わないために使う。
 */
export function focusFirstCellInRow(grid: string, row: number): void {
  cellsInRow(grid, row)[0]?.focus();
}
