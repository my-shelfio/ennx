import { clsx } from "clsx";
import type { ClassValue } from "clsx";

/**
 * クラス名を結合するユーティリティ。条件付きクラスの合成に使う。
 * Tailwind のクラス重複解決（tailwind-merge）は現時点では未導入。
 * バリアントの重複が問題になった場合に導入を検討する。
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
