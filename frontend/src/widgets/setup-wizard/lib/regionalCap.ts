/**
 * 保存済みの入力（regions / regional_caps）から、FDA ステップの「地域数」入力の
 * 初期値を推定する。地域数はストア（`MatchingRequestSchema`）に直接対応する
 * フィールドがないため、regions の最大値+1 と regional_caps の長さから逆算する。
 * どちらも空の場合は 1（最小値）を返す。
 */
export function computeInitialRegionCount(
  regions: readonly number[] | null | undefined,
  regionalCaps: readonly number[] | null | undefined,
): number {
  const regionList = regions ?? [];
  const maxRegion = regionList.reduce((max, region) => Math.max(max, region), -1);
  const fromCapsLength = (regionalCaps ?? []).length;
  return Math.max(maxRegion + 1, fromCapsLength, 1);
}
