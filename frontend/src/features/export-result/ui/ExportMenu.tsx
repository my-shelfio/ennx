import type { MatchingInput, MatchingResult } from "../../../entities/matching";
import { downloadFile, formatTimestamp, UTF8_BOM } from "../../../shared/lib";
import { DropdownMenu, useToast } from "../../../shared/ui";
import { buildAssignmentCsv } from "../lib/buildCsvExport";
import { buildJsonExport } from "../lib/buildJsonExport";

export interface ExportMenuProps {
  input: MatchingInput;
  result: MatchingResult;
}

/**
 * 結果エクスポートの形式選択メニュー。
 * エクスポートボタン → 形式選択肢（JSON/CSV）表示 → 形式選択 →
 * クライアント内でファイル生成・ダウンロード（サーバー往復なし）という流れで動作する。
 */
export function ExportMenu({ input, result }: ExportMenuProps) {
  const { toast } = useToast();

  function handleExportJson() {
    const timestamp = formatTimestamp(new Date());
    const json = buildJsonExport(input, result);
    downloadFile(
      `matching-result-${timestamp}.json`,
      JSON.stringify(json, null, 2),
      "application/json",
    );
    toast({ title: "JSON形式でダウンロードしました", variant: "neutral" });
  }

  function handleExportCsv() {
    const timestamp = formatTimestamp(new Date());
    const csv = buildAssignmentCsv(result, input.proposer_prefs);
    downloadFile(`matching-result-${timestamp}.csv`, `${UTF8_BOM}${csv}`, "text/csv");
    toast({ title: "CSV形式でダウンロードしました", variant: "neutral" });
  }

  return (
    <DropdownMenu
      triggerLabel="エクスポート"
      menuLabel="エクスポート形式を選択"
      items={[
        { key: "json", label: "JSON形式（全量）", onSelect: handleExportJson },
        { key: "csv", label: "CSV形式（配属表）", onSelect: handleExportCsv },
      ]}
    />
  );
}
