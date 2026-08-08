import type { MatchingInput } from "../../../entities/matching";
import { Button, useToast } from "../../../shared/ui";
import { buildShareUrl } from "../lib/shareUrl";

export interface ShareLinkButtonProps {
  input: MatchingInput;
}

/**
 * 共有リンクをコピーするボタン。
 *
 * 設定＋選好の入力一式を URL に圧縮エンコードし、開いた側で同じ入力を再現できるリンクを
 * クリップボードへコピーする（サーバー保存を行わない、ステートレスな方針を維持）。
 * URL がしきい値を超える場合はコピーせず、エクスポート（JSON）の利用を案内する。
 */
export function ShareLinkButton({ input }: ShareLinkButtonProps) {
  const { toast } = useToast();

  async function handleClick() {
    let url: string;
    let exceedsMaxLength: boolean;
    try {
      ({ url, exceedsMaxLength } = await buildShareUrl(window.location.origin, input));
    } catch {
      // 圧縮API（CompressionStream）非対応ブラウザ等、エンコード自体に失敗した場合。
      toast({
        title: "共有リンクを作成できませんでした",
        description: "お使いのブラウザでは共有リンク機能を利用できない可能性があります。",
        variant: "danger",
      });
      return;
    }

    if (exceedsMaxLength) {
      toast({
        title: "共有リンクを作成できませんでした",
        description:
          "入力規模が大きいため、リンクが長くなりすぎます。「エクスポート」からJSON形式でのファイル共有をご利用ください。",
        variant: "danger",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "共有リンクをコピーしました",
        description:
          "リンクを開いた相手にも入力内容（社員名・部署名・希望順位を含む）が共有されます。取り扱いにご注意ください。",
        variant: "neutral",
      });
    } catch {
      toast({
        title: "共有リンクのコピーに失敗しました",
        description: "ブラウザのクリップボード機能を利用できませんでした。再試行してください。",
        variant: "danger",
      });
    }
  }

  return (
    <Button type="button" variant="outline" onClick={() => void handleClick()}>
      共有リンクをコピー
    </Button>
  );
}
