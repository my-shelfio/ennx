import type { ReactNode } from "react";

import { Badge } from "./Badge";
import { reportBadgeStyle } from "./report-badge";

/** 性質レポートの1項目（判定・見出し・詳細説明）。 */
interface ReportBadgeItem {
  status: string;
  label: string;
  detail: string;
}

interface ReportBadgeListProps {
  items: readonly ReportBadgeItem[];
  /** 各ツールチップの詳細説明の下に区切り線付きで添える注意書き。省略時は表示しない。 */
  tooltipNote?: ReactNode;
}

/**
 * 性質レポートのバッジ一覧（✓ / ✗ / ― ＋ 見出し）。
 * 各バッジはフォーカス可能で、ホバー・フォーカス時に詳細説明のツールチップを表示する。
 */
export function ReportBadgeList({ items, tooltipNote }: ReportBadgeListProps) {
  return (
    <ul className="flex flex-wrap gap-3">
      {items.map((item, index) => {
        const badge = reportBadgeStyle(item.status);
        return (
          <li key={index} className="group relative">
            <Badge variant={badge.variant} tabIndex={0}>
              {badge.symbol} {item.label}
            </Badge>
            <div
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-xs -translate-x-1/2 rounded-control bg-slate-900 px-3 py-2 text-xs text-white opacity-0 shadow-popover transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <p>{item.detail}</p>
              {tooltipNote === undefined ? null : (
                <p className="mt-1 border-t border-slate-700 pt-1 text-slate-300">{tooltipNote}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
