import createClient from "openapi-fetch";

import type { paths } from "./schema";
import { ApiError, UnknownApiError, isProblemDetail } from "./problem-detail";

/**
 * 型付き API クライアント。
 * `paths` は `npm run gen:api-types`（backend の OpenAPI スキーマ由来）で
 * 生成する。バックエンドのスキーマ変更はここを経由する呼び出しの型エラーとして検出される。
 *
 * ベース URL は `VITE_API_BASE_URL`（未設定時は同一オリジン）。
 * 未設定時、ブラウザでは相対パスのままでも同一オリジンに解決されるが、
 * openapi-fetch は内部で `new Request(url)` を素の Node（テスト環境の undici）で
 * 構築するため、相対パスだと URL 解析に失敗する。
 * `window.location.origin` が取得できる場合はそれを明示的なベース URL として使う
 * （ブラウザでは実質的に相対パスと同じ結果になり、vitest（jsdom）では
 * `vi.stubGlobal("fetch", ...)` によるモックが機能するようになる）。
 */
const baseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  (typeof window !== "undefined" ? window.location.origin : "");

export const apiClient = createClient<paths>({
  baseUrl,
  // openapi-fetch は createClient() 呼び出し時（＝モジュール読み込み時）に
  // fetch の参照を一度だけ束縛する。テストで `vi.stubGlobal("fetch", ...)`
  // を使えるよう、呼び出しごとに globalThis.fetch を動的に参照するラッパーを渡す。
  fetch: (input) => globalThis.fetch(input),
});

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/**
 * openapi-fetch の `{data, error, response}` をアプリの例外型に正規化する。
 * TanStack Query の `queryFn`/`mutationFn` から呼び出す想定
 * （具体的な query/mutation フックは features 層で実装する）。
 */
export async function unwrap<T>(promise: Promise<FetchResult<T>>): Promise<T> {
  const { data, error } = await promise;

  if (error !== undefined) {
    if (isProblemDetail(error)) {
      throw new ApiError(error);
    }
    throw new UnknownApiError(error);
  }

  if (data === undefined) {
    throw new UnknownApiError(new Error("レスポンスボディが空です"));
  }

  return data;
}

/**
 * `unwrap` のボディ無し版（204 No Content 等）。
 * openapi-fetch は 204 応答で `data`/`error` とも `undefined` を返すため、
 * `unwrap` の「`data` が `undefined` ならエラー」という判定はここでは使えない
 * （投票の締切・削除・投票送信など、204 を返す投票 API 向け）。
 */
export async function unwrapVoid(promise: Promise<FetchResult<unknown>>): Promise<void> {
  const { error } = await promise;

  if (error !== undefined) {
    if (isProblemDetail(error)) {
      throw new ApiError(error);
    }
    throw new UnknownApiError(error);
  }
}
