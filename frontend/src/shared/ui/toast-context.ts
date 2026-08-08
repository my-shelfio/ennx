import { createContext, useContext } from "react";

export type ToastVariant = "neutral" | "ok" | "warning" | "danger";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** 表示時間（ms）。省略時は Radix の既定値を使う。 */
  durationMs?: number;
}

export interface ToastContextValue {
  /** トーストを表示する。エラー通知や実行結果の通知に使う。 */
  toast: (input: ToastInput) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

/** ToastProvider の内側で呼び出し、トースト表示関数を取得する。 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error("useToast は ToastProvider の内側でのみ使用できます");
  }
  return ctx;
}
