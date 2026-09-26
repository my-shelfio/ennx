import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** タイトル下の補足（任意）。 */
  description?: string;
  children: ReactNode;
}

/**
 * 汎用モーダルダイアログ。@radix-ui/react-dialog にフォーカストラップ・Esc クローズ・
 * オーバーレイクリックでのクローズを委譲する。
 * モバイル幅（`sm` 未満）では画面全体を覆い、それ以上では中央のパネルとして表示する。
 */
export function Dialog({ open, onOpenChange, title, description, children }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40" />
        <RadixDialog.Content
          {...(description === undefined ? { "aria-describedby": undefined } : {})}
          className={cn(
            "fixed inset-0 z-50 flex flex-col bg-white shadow-popover outline-none",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-full sm:max-w-2xl",
            "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-1">
              <RadixDialog.Title className="text-base font-semibold text-slate-900">
                {title}
              </RadixDialog.Title>
              {description !== undefined && (
                <RadixDialog.Description className="text-sm text-slate-500">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              aria-label="閉じる"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <span aria-hidden="true">×</span>
            </RadixDialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
