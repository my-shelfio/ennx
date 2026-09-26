import { Link } from "react-router-dom";

import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../../shared/ui";

import { PROBLEM_CARDS } from "../lib/problemCards";

/**
 * ホーム画面「どんな課題を解決するか」セクション。
 * モジュール名ではなく困りごとを入口にし、対応するモジュールの導入ページへ導く。
 * ヒーローの CTA はこのセクション（id="problems"）へページ内スクロールする。
 */
export function ProblemSection() {
  return (
    <section id="problems" className="scroll-mt-16 bg-slate-50 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-bold text-slate-900">
          どんな課題を解決するか
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          組織の「決められない・説明できない」を、経済学の理論で扱える形にします。
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEM_CARDS.map((card) => (
            <Card key={card.key} className="flex flex-col">
              <CardHeader>
                <CardTitle>{card.problem}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription>{card.solution}</CardDescription>
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link to={card.href}>{card.ctaLabel}</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
