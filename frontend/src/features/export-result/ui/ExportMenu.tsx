import { useState } from "react";

import type { MatchingInput, MatchingResult } from "../../../entities/matching";
import { downloadFile, UTF8_BOM } from "../../../shared/lib";
import { Button, useToast } from "../../../shared/ui";
import { buildAssignmentCsv } from "../lib/buildCsvExport";
import { buildJsonExport } from "../lib/buildJsonExport";

export interface ExportMenuProps {
  input: MatchingInput;
  result: MatchingResult;
}

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * 結果エクスポートの形式選択メニュー。
 * エクスポートボタン → 形式選択肢（JSON/CSV）表示 → 形式選択 →
 * クライアント内でファイル生成・ダウンロード（サーバー往復なし）という流れで動作する。
 */
export function ExportMenu({ input, result }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  function handleExportJson() {
    const timestamp = formatTimestamp(new Date());
    const json = buildJsonExport(input, result);
    downloadFile(
      `matching-result-${timestamp}.json`,
      JSON.stringify(json, null, 2),
      "application/json",
    );
    setIsOpen(false);
    toast({ title: "JSON形式でダウンロードしました", variant: "neutral" });
  }

  function handleExportCsv() {
    const timestamp = formatTimestamp(new Date());
    const csv = buildAssignmentCsv(result, input.proposer_prefs);
    downloadFile(`matching-result-${timestamp}.csv`, `${UTF8_BOM}${csv}`, "text/csv");
    setIsOpen(false);
    toast({ title: "CSV形式でダウンロードしました", variant: "neutral" });
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
          className="absolute right-0 z-10 mt-2 flex w-48 flex-col overflow-hidden rounded-control border border-slate-200 bg-white shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            className="px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={handleExportJson}
          >
            JSON形式（全量）
          </button>
          <button
            type="button"
            role="menuitem"
            className="px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={handleExportCsv}
          >
            CSV形式（配属表）
          </button>
        </div>
      ) : null}
    </div>
  );
}
