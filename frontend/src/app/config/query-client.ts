import { QueryClient } from "@tanstack/react-query";

/**
 * TanStack Query の QueryClient ファクトリ。
 * Render Free のコールドスタート（数十秒規模）を踏まえ、失敗時は指数バックオフで
 * 自動リトライしつつ、UI 側にも手動リトライ導線を用意する（ColdStartNotice 参照）。
 * テストで状態を共有しないよう、呼び出しごとに新しいインスタンスを生成する。
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  });
}
