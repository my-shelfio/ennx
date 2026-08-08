import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import { AnimatePresence, motion, useReducedMotion } from "../lib/motion";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

/**
 * 汎用ドロワー（#114）。@radix-ui/react-dialog にフォーカストラップ・Esc クローズ・
 * オーバーレイクリックでのクローズを委譲する（Toast.tsx と同様の Radix + motion 合成パターン）。
 * `prefers-reduced-motion` 時はトランジションを実質ゼロにする。
 * グローバルナビ（widgets/global-nav）のドロワー UI として使う想定。
 */
export function Drawer({ open, onOpenChange, title, children }: DrawerProps) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion === true
    ? { duration: 0 }
    : { duration: 0.2, ease: "easeOut" as const };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition}
                className="fixed inset-0 z-40 bg-slate-900/40"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={transition}
                className={cn(
                  "fixed inset-y-0 left-0 z-50 flex w-full max-w-xs flex-col",
                  "bg-white shadow-popover outline-none",
                )}
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                  <Dialog.Title className="text-base font-semibold text-slate-900">
                    {title}
                  </Dialog.Title>
                  <Dialog.Close
                    aria-label="メニューを閉じる"
                    className="flex h-11 w-11 items-center justify-center rounded-control text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <span aria-hidden="true">×</span>
                  </Dialog.Close>
                </div>
                <div className="flex-1 overflow-y-auto">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
