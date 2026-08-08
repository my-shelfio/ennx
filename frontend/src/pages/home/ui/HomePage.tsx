import { Link } from "react-router-dom";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../shared/ui";
import { ROUTES } from "../../../shared/config";

import { ColdStartNotice } from "./ColdStartNotice";
import { DemoSection } from "./DemoSection";
import { FaqSection } from "./FaqSection";
import { FeatureOverviewSection } from "./FeatureOverviewSection";
import { RoadmapSection } from "./RoadmapSection";

interface AlgorithmCard {
  code: string;
  name: string;
  description: string;
}

// アルゴリズムの説明は開発ルールの定義に基づく。
const ALGORITHM_CARDS: readonly AlgorithmCard[] = [
  {
    code: "DA",
    name: "受入保留方式（Deferred Acceptance）",
    description:
      "定員制約のもとで、提案者にとって最適な安定マッチングを実現する基本アルゴリズム。",
  },
  {
    code: "FDA",
    name: "柔軟な受入保留方式（Flexible DA）",
    description:
      "地域ごとの受け入れ上限を考慮した配属（研修医マッチング等）。地域上限を守りながら効率的に配属する。",
  },
  {
    code: "CA",
    name: "カットオフ調整（Cutoff Adjustment）",
    description:
      "予算・属性人数などの複合的な上限制約に対応する、提案者最適かつ公平な配属を実現する。",
  },
] as const;

/**
 * ホーム画面。
 * ヒーローセクション（グラデーション + CTA）、「今使える機能」（配属マッチング・
 * 投票を対等に提示）、デモセクション、アルゴリズム 3 種の機能カード、
 * 「今後の展開」（検討中テーマの予告）、FAQ セクションで構成する。
 */
export function HomePage() {
  return (
    <>
      <section className="bg-gradient-brand px-4 py-20 text-center sm:px-6 sm:py-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
            組織の意思決定を、経済学の理論で。
          </h1>
          <p className="max-w-2xl text-sm text-primary-50 sm:text-base">
            ennx は組織の問題を経済学の理論で可視化し、意思決定を支援します。配属マッチングや
            投票・合意形成など、理論に基づくツールをブラウザだけで実行・可視化できます。
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="secondary" size="lg">
              <Link to={ROUTES.matching.setup}>マッチングを始める</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to={`${ROUTES.matching.setup}?sample=1`}>サンプルデータで試す</Link>
            </Button>
          </div>
          <ColdStartNotice />
        </div>
      </section>

      <FeatureOverviewSection />

      <DemoSection />

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">
          3 種類のマッチングアルゴリズム
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          制約の種類に応じて、理論的に性質が保証されたアルゴリズムを選択できます。
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ALGORITHM_CARDS.map((algorithm) => (
            <Card key={algorithm.code}>
              <CardHeader>
                <span className="w-fit rounded-pill bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                  {algorithm.code}
                </span>
                <CardTitle>{algorithm.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{algorithm.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <RoadmapSection />

      <FaqSection />
    </>
  );
}
