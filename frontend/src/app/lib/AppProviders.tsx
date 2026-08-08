import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";

import { AppMotionConfig } from "../../shared/lib";
import { ToastProvider } from "../../shared/ui";

import { createQueryClient } from "../config/query-client";

/**
 * アプリ全体のプロバイダをまとめる。
 * QueryClient（サーバー通信）・ToastProvider（通知）・AppMotionConfig
 * （`prefers-reduced-motion` 尊重のモーション設定、shared/lib/motion.ts 参照）を配線する。
 * Router（BrowserRouter）はマウント直下に一度だけ必要なため App.tsx 側で用意する。
 */
export function AppProviders({ children }: { children: ReactNode }) {
  // コンポーネントの再レンダーで QueryClient が作り直されないよう useState の
  // 初期化関数で一度だけ生成する。
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AppMotionConfig reducedMotion="user">
        <ToastProvider>{children}</ToastProvider>
      </AppMotionConfig>
    </QueryClientProvider>
  );
}
