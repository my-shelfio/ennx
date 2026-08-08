import { useMatchingInputStore, useMatchingResultStore } from "../../../entities/matching";
import { Button, useToast } from "../../../shared/ui";

/**
 * 「入力データをクリア」導線。
 * 共有端末で利用した後、入力データを利用者自身が消去できるようにするため、
 * 全ページ共通レイアウト（app/layout/AppLayout）のヘッダーに配置する。
 * 入力（localStorage 永続化）・実行結果（非永続）の両方をクリアする。
 */
export function ClearDataButton() {
  const clearInput = useMatchingInputStore((state) => state.clear);
  const clearResult = useMatchingResultStore((state) => state.clear);
  const { toast } = useToast();

  function handleClick() {
    const confirmed = window.confirm(
      "入力データと実行結果を消去します。この操作は取り消せません。よろしいですか？",
    );
    if (!confirmed) {
      return;
    }
    clearInput();
    clearResult();
    toast({ title: "入力データを消去しました", variant: "neutral" });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick}>
      入力データをクリア
    </Button>
  );
}
