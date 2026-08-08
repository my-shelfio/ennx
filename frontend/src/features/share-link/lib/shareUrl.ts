import type { MatchingInput } from "../../../entities/matching";
import { ROUTES } from "../../../shared/config";

import { encodeShareLinkData } from "./shareLinkCodec";

/**
 * 共有リンクの URL 長のしきい値（文字数）。超過時はコピーを案内せず、
 * エクスポート（JSON）の利用を案内する。
 * 部署50×社員100の最大規模の選好行列は概ね 2,000〜8,000 文字程度になる想定。
 * 主要ブラウザの URL 長上限（実用上 8,000 文字前後まで問題なく扱えることが多い）を踏まえ、
 * 想定レンジの上限に合わせたしきい値とする。
 */
export const MAX_SHARE_URL_LENGTH = 8000;

export interface ShareUrlResult {
  url: string;
  /** URL がしきい値を超えており、コピーを案内すべきでない場合に true。 */
  exceedsMaxLength: boolean;
}

/**
 * 現在の入力から共有リンク（設定ウィザードの URL + `?d=` パラメータ）を組み立てる。
 * `origin` は呼び出し側（UI）が `window.location.origin` を渡す
 * （lib はブラウザ API に直接依存させない方針、features/export-result の download.ts と同様）。
 */
export async function buildShareUrl(origin: string, input: MatchingInput): Promise<ShareUrlResult> {
  const encoded = await encodeShareLinkData(input);
  const url = `${origin}${ROUTES.matching.setup}?d=${encoded}`;
  return { url, exceedsMaxLength: url.length > MAX_SHARE_URL_LENGTH };
}
