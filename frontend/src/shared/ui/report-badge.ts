/**
 * 性質レポートの判定（ok / ng / info）ごとのバッジ表示（記号・色）。
 * コンポーネント本体から分離し、react-refresh の「コンポーネントのみを export するファイル」
 * 制約を満たす。
 */
interface ReportBadgeStyle {
  symbol: string;
  variant: "ok" | "danger" | "neutral";
}

const REPORT_BADGE: Record<string, ReportBadgeStyle> = {
  ok: { symbol: "✓", variant: "ok" },
  ng: { symbol: "✗", variant: "danger" },
  info: { symbol: "―", variant: "neutral" },
};

/** 判定に対応するバッジ表示を返す。未知の判定は info（― / neutral）として扱う。 */
export function reportBadgeStyle(status: string): ReportBadgeStyle {
  return REPORT_BADGE[status] ?? { symbol: "―", variant: "neutral" };
}
