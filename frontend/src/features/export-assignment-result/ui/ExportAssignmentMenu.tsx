import { useState } from "react";

import type { AssignmentInput, AssignmentResult } from "../../../entities/assignment";
import { downloadFile, UTF8_BOM } from "../../../shared/lib";
import { Button, useToast } from "../../../shared/ui";
import {
  buildDrawnAssignmentCsv,
  buildExpectedAssignmentCsv,
  buildInputCsv,
} from "../lib/buildCsvExport";
import { buildJsonExport } from "../lib/buildJsonExport";

export interface ExportAssignmentMenuProps {
  input: AssignmentInput;
  result: AssignmentResult;
}

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * 割り当て結果のエクスポートメニュー。
 * クライアント内でファイルを生成する（サーバー往復なし）。
 *
 * 形式は 3 つ。説明の場で配るのは「配属表」、根拠として添えるのが「期待割当」、
 * 再実行のための控えが「JSON（全量）」という使い分けを想定する。
 */
export function ExportAssignmentMenu({ input, result }: ExportAssignmentMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  function download(name: string, content: string, mime: string, label: string) {
    downloadFile(name, content, mime);
    setIsOpen(false);
    toast({ title: `${label}をダウンロードしました`, variant: "neutral" });
  }

  function handleExportDrawn() {
    const timestamp = formatTimestamp(new Date());
    download(
      `assignment-result-${timestamp}.csv`,
      `${UTF8_BOM}${buildDrawnAssignmentCsv(result)}`,
      "text/csv",
      "配属表（CSV）",
    );
  }

  function handleExportExpected() {
    const timestamp = formatTimestamp(new Date());
    const csv = `${buildExpectedAssignmentCsv(result)}\r\n\r\n${buildInputCsv(input, result)}`;
    download(
      `assignment-expected-${timestamp}.csv`,
      `${UTF8_BOM}${csv}`,
      "text/csv",
      "期待割当（CSV）",
    );
  }

  function handleExportJson() {
    const timestamp = formatTimestamp(new Date());
    download(
      `assignment-result-${timestamp}.json`,
      JSON.stringify(buildJsonExport(input, result), null, 2),
      "application/json",
      "JSON（全量）",
    );
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        エクスポート
      </Button>
      {isOpen ? (
        <div
          role="menu"
          aria-label="エクスポート形式を選択"
          className="absolute right-0 z-10 mt-2 flex w-64 flex-col overflow-hidden rounded-control border border-slate-200 bg-white shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            className="px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={handleExportDrawn}
          >
            CSV形式（配属表・抽選結果）
          </button>
          <button
            type="button"
            role="menuitem"
            className="px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={handleExportExpected}
          >
            CSV形式（期待割当・入力の控え）
          </button>
          <button
            type="button"
            role="menuitem"
            className="px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={handleExportJson}
          >
            JSON形式（全量）
          </button>
        </div>
      ) : null}
    </div>
  );
}
