/**
 * クライアント内でファイルを生成しダウンロードさせる。
 * サーバー往復なしで完結させるため、保持しているデータから Blob を生成し
 * `<a download>` の一時クリックでダウンロードを開始する。
 *
 * features/export-result（結果エクスポート）・features/import-input
 * （テンプレートCSV配布・現在の入力のCSVエクスポート）の双方が使うため shared 層に置く。
 */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(url);
  }
}
