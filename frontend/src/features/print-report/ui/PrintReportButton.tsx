import { Button } from "../../../shared/ui";

export interface PrintReportButtonProps {
  label?: string;
}

/**
 * 印刷用レポートの出力ボタン。ブラウザの印刷ダイアログ（`window.print()`）を開く。
 * PDF はブラウザの「PDF に保存」に委ね、サーバー側では生成しない。
 * 印刷時の見た目は印刷用スタイル（`@media print`）と {@link PrintReportHeader} が担う。
 */
export function PrintReportButton({ label = "印刷用レポート" }: PrintReportButtonProps) {
  return (
    <Button type="button" variant="outline" className="print:hidden" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
