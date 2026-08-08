import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../shared/ui";

export interface ResumePromptProps {
  onResume: () => void;
  onDiscard: () => void;
}

/**
 * localStorage に前回の入力途中データが残っている場合の再開/破棄の選択 UI。
 */
export function ResumePrompt({ onResume, onDiscard }: ResumePromptProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>前回の続きから再開しますか？</CardTitle>
        <CardDescription>
          入力途中のデータがブラウザに保存されています。再開するか、破棄して新規に入力するか選べます。
        </CardDescription>
      </CardHeader>
      <CardContent />
      <CardFooter className="justify-end gap-3">
        <Button type="button" variant="outline" onClick={onDiscard}>
          破棄して新規
        </Button>
        <Button type="button" onClick={onResume}>
          再開する
        </Button>
      </CardFooter>
    </Card>
  );
}
