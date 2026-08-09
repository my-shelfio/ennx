import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { cn } from "../../../shared/lib";
import { Drawer } from "../../../shared/ui";
import { isMenuItemActive, MENU_ITEMS } from "../model/menuItems";

/**
 * グローバルナビ。ハンバーガーボタンとドロワーメニュー本体をまとめて提供する。
 * 将来の複数モジュール化（情報共有・インセンティブ設計）に備え、全画面幅で同一の
 * ハンバーガー＋ドロワー方式に統一する（ハンバーガーナビゲーション導入 実行計画）。
 * ページ遷移時はドロワーを自動的に閉じる（副作用ではなくレンダー中の状態調整で行う。
 * https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes）。
 */
export function GlobalNav() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const [renderedPathname, setRenderedPathname] = useState(location.pathname);

  if (location.pathname !== renderedPathname) {
    setRenderedPathname(location.pathname);
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        aria-label="メニューを開く"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-control text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        <span aria-hidden="true" className="flex flex-col gap-1.5">
          <span className="block h-0.5 w-5 bg-current" />
          <span className="block h-0.5 w-5 bg-current" />
          <span className="block h-0.5 w-5 bg-current" />
        </span>
      </button>

      <Drawer open={isOpen} onOpenChange={setIsOpen} title="メニュー">
        <nav aria-label="グローバルナビゲーション" className="flex flex-col gap-1 p-4">
          {MENU_ITEMS.map((item) => {
            if (item.comingSoon === true || item.path === undefined) {
              return (
                <div
                  key={item.id}
                  title={item.description}
                  aria-disabled="true"
                  className="flex items-center justify-between rounded-control px-3 py-3 text-sm text-slate-400"
                >
                  <span>{item.label}</span>
                  <span className="rounded-pill bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                    準備中
                  </span>
                </div>
              );
            }

            const active = isMenuItemActive(item, location.pathname);
            return (
              <Link
                key={item.id}
                to={item.path}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-control px-3 py-3 text-sm font-medium",
                  active
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-700 hover:bg-slate-100",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </Drawer>
    </>
  );
}
