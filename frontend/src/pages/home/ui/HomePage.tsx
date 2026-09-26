import { Button } from "../../../shared/ui";

import { ColdStartNotice } from "./ColdStartNotice";
import { FaqSection } from "./FaqSection";
import { FeatureOverviewSection } from "./FeatureOverviewSection";
import { ProblemSection } from "./ProblemSection";
import { RoadmapSection } from "./RoadmapSection";

const HIGHLIGHTS = ["登録不要", "インストール不要", "無料"] as const;

/** 課題セクション（ProblemSection）のアンカー。ヒーローの CTA からページ内スクロールする。 */
const PROBLEMS_ANCHOR = "#problems";

/**
 * ホーム画面。
 * アプリ全体の位置付け（何ができるか・どんな課題を解決するか）を伝える場とし、
 * モジュール固有の説明は各モジュールの導入ページに置く。
 * ヒーローセクション（モジュール中立の CTA 1 件）、「どんな課題を解決するか」、
 * 「今使える機能」（3 モジュールを対等なカードで提示）、「今後の展開」、FAQ で構成する。
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
          <ul className="flex flex-wrap justify-center gap-2">
            {HIGHLIGHTS.map((highlight) => (
              <li
                key={highlight}
                className="rounded-pill bg-white/15 px-3 py-1 text-xs font-semibold text-white"
              >
                {highlight}
              </li>
            ))}
          </ul>
          <Button asChild variant="secondary" size="lg">
            <a href={PROBLEMS_ANCHOR}>解決できる課題を見る</a>
          </Button>
          <ColdStartNotice />
        </div>
      </section>

      <ProblemSection />

      <FeatureOverviewSection />

      <RoadmapSection />

      <FaqSection />
    </>
  );
}
