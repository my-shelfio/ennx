import { useState } from "react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";

import { Button } from "./Button";

interface DropdownMenuItem {
  /** 項目の識別子（React の key に使う）。 */
  key: string;
  label: ReactNode;
  /** 項目選択時の処理。呼び出し後にメニューを閉じる。 */
  onSelect: () => void;
}

interface DropdownMenuProps {
  /** 開閉ボタンの表示内容。 */
  triggerLabel: ReactNode;
  /** メニュー（`role="menu"`）のアクセシブルな名前。 */
  menuLabel: string;
  items: readonly DropdownMenuItem[];
  /** メニューの幅（Tailwind の幅クラス）。項目の文言の長さに合わせて指定する。 */
  widthClassName?: string;
}

/**
 * ボタンで開閉する項目選択メニュー。
 * 開閉状態を内部で持ち、ボタンに `aria-haspopup`・`aria-expanded` を付ける。
 * 項目を選ぶと `onSelect` を呼んでからメニューを閉じる。
 */
export function DropdownMenu({
  triggerLabel,
  menuLabel,
  items,
  widthClassName = "w-48",
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {triggerLabel}
      </Button>
      {isOpen ? (
        <div
          role="menu"
          aria-label={menuLabel}
          className={cn(
            "absolute right-0 z-10 mt-2 flex flex-col overflow-hidden rounded-control border border-slate-200 bg-white shadow-md",
            widthClassName,
          )}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className="px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                item.onSelect();
                setIsOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
