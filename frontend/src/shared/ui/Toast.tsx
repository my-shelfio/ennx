import * as ToastPrimitive from "@radix-ui/react-toast";
import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import { AnimatePresence, motion, useReducedMotion } from "../lib/motion";

import type { ToastContextValue, ToastInput, ToastVariant } from "./toast-context";
import { ToastContext } from "./toast-context";

interface ToastRecord extends ToastInput {
  id: string;
}

const variantClassName: Record<ToastVariant, string> = {
  neutral: "border-slate-200 bg-white",
  ok: "border-ok-100 bg-ok-50",
  warning: "border-warning-100 bg-warning-50",
  danger: "border-danger-100 bg-danger-50",
};

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `toast-${idCounter}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastRecord[]>([]);
  const prefersReducedMotion = useReducedMotion();

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = nextId();
    setItems((current) => [...current, { ...input, id }]);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  // reduce-motion 環境ではスライド/フェードのトランジションを実質ゼロにする。
  const transition = prefersReducedMotion === true
    ? { duration: 0 }
    : { duration: 0.2, ease: "easeOut" as const };

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        <AnimatePresence>
          {items.map((item) => (
            <ToastPrimitive.Root
              key={item.id}
              forceMount
              duration={item.durationMs ?? 5000}
              onOpenChange={(open) => {
                if (!open) {
                  dismiss(item.id);
                }
              }}
              asChild
            >
              <motion.li
                layout
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 32 }}
                transition={transition}
                className={cn(
                  "pointer-events-auto relative flex w-80 flex-col gap-1 rounded-control border p-4 shadow-popover",
                  variantClassName[item.variant ?? "neutral"],
                )}
              >
                <ToastPrimitive.Title className="text-sm font-semibold text-slate-900">
                  {item.title}
                </ToastPrimitive.Title>
                {item.description !== undefined ? (
                  <ToastPrimitive.Description className="text-sm text-slate-600">
                    {item.description}
                  </ToastPrimitive.Description>
                ) : null}
                <ToastPrimitive.Close
                  className="absolute right-2 top-2 rounded-control p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="閉じる"
                >
                  ×
                </ToastPrimitive.Close>
              </motion.li>
            </ToastPrimitive.Root>
          ))}
        </AnimatePresence>
        <ToastPrimitive.Viewport
          className={cn(
            "fixed bottom-0 right-0 z-50 m-0 flex w-96 max-w-[100vw] list-none flex-col gap-2 p-6",
          )}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
