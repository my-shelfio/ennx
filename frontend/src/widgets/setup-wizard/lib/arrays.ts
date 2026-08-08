/**
 * 配列の長さを `size` に揃える（不足分は `fill` で補い、超過分は切り詰める）。
 * ステップ「規模」で部署数・社員数が変更された際、定員等の入力配列を
 * 追従させるために使う。
 */
export function resizeArray<T>(array: readonly T[], size: number, fill: T): T[] {
  if (array.length === size) {
    return [...array];
  }
  if (array.length > size) {
    return array.slice(0, size);
  }
  return [...array, ...(Array.from({ length: size - array.length }, () => fill) as T[])];
}
