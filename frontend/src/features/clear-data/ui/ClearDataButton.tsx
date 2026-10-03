import { useAssignmentInputStore, useAssignmentResultStore } from "../../../entities/assignment";
import { useMatchingInputStore, useMatchingResultStore } from "../../../entities/matching";
import { useIssuedResultShareStore } from "../../../entities/result-share";
import { Button, useToast } from "../../../shared/ui";

/**
 * 「入力データをクリア」導線。
 * 共有端末で利用した後、入力データを利用者自身が消去できるようにするため、
 * 全ページ共通レイアウト（app/layout/AppLayout）のヘッダーに配置する。
 * 入力（localStorage 永続化）・実行結果（非永続）の両方をクリアする。
 * 発行した閲覧用 URL の一覧（URL と削除用トークン。localStorage 永続化）も消去する
 * （閲覧用 URL から入力の社員名等を閲覧できるため）。サーバー上の共有データは
 * 消去しないため、確認文で先に削除するよう案内する。
 *
 * **クライアントに入力を残すモジュールを増やしたら、必ずここにも追加する**。
 * 1 つでも漏れると「クリアしたのに残っている」状態になり、共有端末での利用後に
 * 消去できるという要件が崩れる。現在の対象はマッチング（発行した閲覧用 URL を含む）と
 * 割り当ての 2 つ。
 */
export function ClearDataButton() {
  const clearMatchingInput = useMatchingInputStore((state) => state.clear);
  const clearMatchingResult = useMatchingResultStore((state) => state.clear);
  const clearAssignmentInput = useAssignmentInputStore((state) => state.clear);
  const clearAssignmentResult = useAssignmentResultStore((state) => state.clear);
  const clearIssuedResultShares = useIssuedResultShareStore((state) => state.clear);
  const { toast } = useToast();

  function handleClick() {
    const confirmed = window.confirm(
      "入力データと実行結果を消去します。発行した閲覧用 URL の一覧も消去され、以後このブラウザから削除できなくなります（URL は期限まで有効です。不要なら先に結果画面の「閲覧用 URL を発行」から削除してください）。この操作は取り消せません。よろしいですか？",
    );
    if (!confirmed) {
      return;
    }
    clearMatchingInput();
    clearMatchingResult();
    clearAssignmentInput();
    clearAssignmentResult();
    clearIssuedResultShares();
    toast({ title: "入力データを消去しました", variant: "neutral" });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick}>
      入力データをクリア
    </Button>
  );
}
