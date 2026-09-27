import type { AssignmentInput, AssignmentResult } from "../../../entities/assignment";
import { downloadFile, formatTimestamp, UTF8_BOM } from "../../../shared/lib";
import { DropdownMenu, useToast } from "../../../shared/ui";
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

/**
 * 割り当て結果のエクスポートメニュー。
 * クライアント内でファイルを生成する（サーバー往復なし）。
 *
 * 形式は 3 つ。説明の場で配るのは「配属表」、根拠として添えるのが「期待割当」、
 * 再実行のための控えが「JSON（全量）」という使い分けを想定する。
 */
export function ExportAssignmentMenu({ input, result }: ExportAssignmentMenuProps) {
  const { toast } = useToast();

  function download(name: string, content: string, mime: string, label: string) {
    downloadFile(name, content, mime);
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
    <DropdownMenu
      triggerLabel="エクスポート"
      menuLabel="エクスポート形式を選択"
      widthClassName="w-64"
      items={[
        { key: "drawn", label: "CSV形式（配属表・抽選結果）", onSelect: handleExportDrawn },
        { key: "expected", label: "CSV形式（期待割当・入力の控え）", onSelect: handleExportExpected },
        { key: "json", label: "JSON形式（全量）", onSelect: handleExportJson },
      ]}
    />
  );
}
