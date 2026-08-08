import { QueryClient } from "@tanstack/react-query";

/**
 * TanStack Query の QueryClient ファクトリ。
 * Render Free のコールドスタート（数十秒規模）を踏まえ、失敗時は指数バックオフで
 * 自動リトライしつつ、UI 側にも手動リトライ導線を用意する（ColdStartNotice 参照）。
 * shared/api にも API クライアント統合の QueryClient が別途用意される予定。
 * それまでの間、app 層でこのインスタンスを保持する。
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
