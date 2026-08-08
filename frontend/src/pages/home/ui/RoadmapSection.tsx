import { Badge } from "../../../shared/ui";

import { ROADMAP_ITEMS } from "../lib/roadmapItems";

/**
 * ホーム画面「今後の展開」帯。
 * まだ提供していない検討中のテーマを、リンクを持たせずに列挙する
 * （未提供機能をあるように見せないため）。新しい色相は追加せず、
 * 既存の slate トーン（Badge の neutral variant）のみで「検討中」を表す。
 */
export function RoadmapSection() {
  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <div className="rounded-card border border-dashed border-slate-300 bg-white p-6 sm:p-8">
        <h2 className="text-center text-lg font-semibold text-slate-700">今後の展開</h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          以下のテーマも、経済学の理論を使ったツールとして検討しています。
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {ROADMAP_ITEMS.map((item) => (
            <li key={item.key} className="flex flex-col gap-2 rounded-control bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{item.title}</span>
                <Badge variant="neutral">検討中</Badge>
              </div>
              <p className="text-xs text-slate-500">{item.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
