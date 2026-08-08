import { Link } from "react-router-dom";

import { Button } from "../../../shared/ui";
import { ROUTES } from "../../../shared/config";

import { getDemoMedia } from "../lib/demoMedia";
import { usePrefersReducedMotion } from "../model/usePrefersReducedMotion";

const HIGHLIGHTS = ["登録不要", "インストール不要", "無料"] as const;

/**
 * 「30秒でわかる」デモセクション（#128）。
 * サンプルデータでの「設定 → 選好入力 → 実行 → ステップ再生」の流れを軽量な画像で
 * 提示し、直下に「サンプルデータで試す」CTA を再掲する。
 * 実際の操作画面を収録した GIF/動画（`public/demo-preview-animated.svg` /
 * `public/demo-preview-static.svg`）は現時点ではイラスト調のプレースホルダであり、
 * 実素材への差し替えは follow-up タスク。
 * prefers-reduced-motion が有効な場合は静止画にフォールバックし、自動再生しない。
 */
export function DemoSection() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const media = getDemoMedia(prefersReducedMotion);

  return (
    <section className="bg-slate-50 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap justify-center gap-2">
          {HIGHLIGHTS.map((highlight) => (
            <span
              key={highlight}
              className="rounded-pill bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700"
            >
              {highlight}
            </span>
          ))}
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold text-slate-900">
          30秒でわかる ennx
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          サンプルデータで「設定 → 選好入力 → 実行 → ステップ再生」の流れをご覧いただけます。
        </p>
        <div className="mt-8 overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
          <img
            src={media.src}
            alt={media.alt}
            loading="lazy"
            decoding="async"
            width={1200}
            height={630}
            className="h-auto w-full"
          />
        </div>
        <div className="mt-8 flex justify-center">
          <Button asChild variant="primary" size="lg">
            <Link to={`${ROUTES.matching.setup}?sample=1`}>サンプルデータで試す</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
