import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../shared/ui";

export interface ShareLinkPromptProps {
  /** ブラウザに入力途中のデータが残っている場合、上書きされる旨を強調表示する。 */
  hasExistingInput: boolean;
  onLoad: () => void;
  onCancel: () => void;
}

/**
 * 共有リンク（`?d=`）を開いた際の確認 UI。
 * widgets/setup-wizard の ResumePrompt と役割は近いが、こちらは「リンク経由の入力を
 * 読み込むかどうか」の確認であり別の判断軸のため、widgets の非公開コンポーネントを
 * 流用せず pages 層に置く。
 */
export function ShareLinkPrompt({ hasExistingInput, onLoad, onCancel }: ShareLinkPromptProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>共有リンクの入力内容を読み込みますか？</CardTitle>
        <CardDescription>
          {hasExistingInput
            ? "現在ブラウザに保存されている入力内容は上書きされます。"
            : "リンクに含まれる設定・希望順位を読み込んで、選好入力画面へ進みます。"}
        </CardDescription>
      </CardHeader>
      <CardContent />
      <CardFooter className="justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          読み込まない
        </Button>
        <Button type="button" onClick={onLoad}>
          読み込む
        </Button>
      </CardFooter>
    </Card>
  );
}
