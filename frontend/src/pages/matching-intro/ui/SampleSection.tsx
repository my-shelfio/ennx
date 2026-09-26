import { Link } from "react-router-dom";

import { useSampleList } from "../../../features/load-sample";
import { ROUTES, withSampleQuery } from "../../../shared/config";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../shared/ui";

/**
 * 配属マッチング導入ページのサンプル一覧セクション。
 * サーバーが提供するサンプル（`GET /api/v1/samples`）を、確認できる現象の概要つきで並べ、
 * クリックのみで読み込んで結果まで進めるようにする。一覧の取得に失敗した場合は
 * セクションごと表示しない（ヒーロー・CTA の「サンプルデータで試す」は引き続き使える）。
 */
export function SampleSection() {
  const { data: samples } = useSampleList();

  if (samples === undefined || samples.length === 0) {
    return null;
  }

  return (
    <section className="bg-slate-50 px-4 py-14 sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <h2 className="text-center text-2xl font-bold text-slate-900">サンプルで性質を確かめる</h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          入力済みのサンプルを読み込み、そのまま実行して結果とステップ再生を確認できます。
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {samples.map((sample) => (
            <Card key={sample.key} className="flex flex-col">
              <CardHeader>
                <CardTitle>{sample.label}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription>{sample.summary}</CardDescription>
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline" size="sm">
                  <Link to={withSampleQuery(ROUTES.matching.setup, sample.key)}>
                    このサンプルを読み込む
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
