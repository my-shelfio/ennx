import type { PublicVotingResults } from "../../../entities/voting";
import { downloadFile, formatTimestamp, UTF8_BOM } from "../../../shared/lib";
import { DropdownMenu, useToast } from "../../../shared/ui";
import { buildVotingResultsCsv } from "../lib/buildCsvExport";
import { buildVotingResultsJsonExport } from "../lib/buildJsonExport";

export interface ExportVotingResultsMenuProps {
  results: PublicVotingResults;
}

/**
 * 投票結果のエクスポート形式選択メニュー（`features/export-result/ui/ExportMenu` と同じ設計）。
 */
export function ExportVotingResultsMenu({ results }: ExportVotingResultsMenuProps) {
  const { toast } = useToast();

  function handleExportJson() {
    const timestamp = formatTimestamp(new Date());
    const json = buildVotingResultsJsonExport(results);
    downloadFile(`voting-results-${timestamp}.json`, JSON.stringify(json, null, 2), "application/json");
    toast({ title: "JSON形式でダウンロードしました", variant: "neutral" });
  }

  function handleExportCsv() {
    const timestamp = formatTimestamp(new Date());
    const csv = buildVotingResultsCsv(results);
    downloadFile(`voting-results-${timestamp}.csv`, `${UTF8_BOM}${csv}`, "text/csv");
    toast({ title: "CSV形式でダウンロードしました", variant: "neutral" });
  }

  return (
    <DropdownMenu
      triggerLabel="エクスポート"
      menuLabel="エクスポート形式を選択"
      items={[
        { key: "json", label: "JSON形式（全量）", onSelect: handleExportJson },
        { key: "csv", label: "CSV形式（比較表）", onSelect: handleExportCsv },
      ]}
    />
  );
}
