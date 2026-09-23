import { useEffect, useState } from "react";

export interface PrintReportHeaderProps {
  /** レポート名。 */
  title: string;
  /** レポートの前提（アルゴリズム・規模など）。1 要素 1 行で表示する。 */
  meta?: readonly string[];
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * 印刷時のみ表示するレポート見出し（レポート名・出力日時・前提）。
 * 出力日時は印刷ダイアログを開いた時点（`beforeprint`）の日時に更新する。
 */
export function PrintReportHeader({ title, meta = [] }: PrintReportHeaderProps) {
  const [printedAt, setPrintedAt] = useState(() => new Date());

  useEffect(() => {
    const handleBeforePrint = () => setPrintedAt(new Date());
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => window.removeEventListener("beforeprint", handleBeforePrint);
  }, []);

  return (
    <header className="hidden border-b border-slate-300 pb-3 print:block">
      <p className="text-xs text-slate-500">ennx 印刷用レポート</p>
      <h1 className="mt-1 text-xl font-bold text-slate-900">{title}</h1>
      <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
        <li>出力日時: {formatDateTime(printedAt)}</li>
        {meta.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </header>
  );
}
