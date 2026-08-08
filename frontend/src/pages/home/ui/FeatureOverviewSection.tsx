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

import { FEATURE_CARDS } from "../lib/featureCards";

/**
 * ホーム画面「今使える機能」セクション。
 * 配属マッチング・投票を対等なカードで提示する。カードは `FEATURE_CARDS`
 * （`../lib/featureCards.ts`）に沿って描画するため、将来モジュールの追加は
 * データを1件足すだけで済む。
 */
export function FeatureOverviewSection() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h2 className="text-center text-2xl font-bold text-slate-900">今使える機能</h2>
      <p className="mt-2 text-center text-sm text-slate-500">
        組織の意思決定を、経済学の理論で支援します。今後も理論モジュールを追加していきます。
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {FEATURE_CARDS.map((feature) => (
          <Card key={feature.key} className="flex flex-col">
            <CardHeader>
              <CardTitle>{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <CardDescription>{feature.description}</CardDescription>
            </CardContent>
            <CardFooter>
              <Button asChild variant="primary" className="w-full sm:w-auto">
                <Link to={feature.href}>{feature.ctaLabel}</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
