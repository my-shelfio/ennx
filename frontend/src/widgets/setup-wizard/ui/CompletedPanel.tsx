import { Link } from "react-router-dom";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../shared/ui";
import { ROUTES } from "../../../shared/config";

export interface CompletedPanelProps {
  onBack: () => void;
}

/**
 * 設定の検証完了パネル。選好入力画面への遷移を担う。
 * 選好入力画面本体は widgets/preference-matrix・pages/preferences で実装済み。
 */
export function CompletedPanel({ onBack }: CompletedPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>設定の検証が完了しました</CardTitle>
        <CardDescription>
          入力内容は保存されました。続けて社員・部署の希望順位を入力してください。
        </CardDescription>
      </CardHeader>
      <CardContent />
      <CardFooter className="justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          詳細に戻って修正する
        </Button>
        <Button asChild>
          <Link to={ROUTES.matching.preferences}>希望順位を入力する</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
