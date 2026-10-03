import { useState } from "react";

import type { MatchingInput } from "../../../entities/matching";
import { Button, Dialog } from "../../../shared/ui";

import { ResultSharePanel } from "./ResultSharePanel";

export interface ResultShareButtonProps {
  /** 共有する（結果を計算した）マッチングの入力。 */
  input: MatchingInput;
}

/**
 * 「閲覧用 URL を発行」ボタンと発行ダイアログ。
 *
 * 入力を URL に埋め込む共有リンク（受け手が自分で再実行する）と異なり、入力を
 * 期限付きでサーバーに保存し、受け手が開くだけで結果・性質レポート・実行過程を
 * 確認できる閲覧専用の URL を発行する。保存は本ボタンから明示的に発行したときだけ行う。
 */
export function ResultShareButton({ input }: ResultShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
        閲覧用 URL を発行
      </Button>
      <Dialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="閲覧用 URL を発行"
        description="受け手は URL を開くだけで、結果・性質レポート・実行過程を確認できます（入力の編集・再実行はできません）。"
      >
        <ResultSharePanel input={input} />
      </Dialog>
    </>
  );
}
