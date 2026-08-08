import { useState } from "react";

import type { VotingResults } from "../../../entities/voting";
import { downloadFile, UTF8_BOM } from "../../../shared/lib";
import { Button, useToast } from "../../../shared/ui";
import { buildVotingResultsCsv } from "../lib/buildCsvExport";
import { buildVotingResultsJsonExport } from "../lib/buildJsonExport";

export interface ExportVotingResultsMenuProps {
  results: VotingResults;
}

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * 投票結果のエクスポート形式選択メニュー（`features/export-result/ui/ExportMenu` と同じ設計）。
 */
export function ExportVotingResultsMenu({ results }: ExportVotingResultsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  function handleExportJson() {
    const timestamp = formatTimestamp(new Date());
    const json = buildVotingResultsJsonExport(results);
    downloadFile(`voting-results-${timestamp}.json`, JSON.stringify(json, null, 2), "application/json");
    setIsOpen(false);
    toast({ title: "JSON形式でダウンロードしました", variant: "neutral" });
  }

  function handleExportCsv() {
    const timestamp = formatTimestamp(new Date());
    const csv = buildVotingResultsCsv(results);
    downloadFile(`voting-results-${timestamp}.csv`, `${UTF8_BOM}${csv}`, "text/csv");
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
            CSV形式（比較表）
          </button>
        </div>
      ) : null}
    </div>
  );
}
