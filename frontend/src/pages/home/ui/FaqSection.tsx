import { FAQ_ITEMS } from "../lib/faqItems";

/**
 * FAQ セクション。
 * データの保存先・結果の位置づけ・料金・コールドスタートという、初回訪問者が
 * 疑問に思いやすい点に答える。ネイティブの `<details>` による開閉式レイアウトで、
 * JavaScript 依存なく動作する。
 */
export function FaqSection() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h2 className="text-center text-2xl font-bold text-slate-900">よくある質問</h2>
      <div className="mt-8 flex flex-col gap-3">
        {FAQ_ITEMS.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-card border border-slate-200 bg-white p-4 shadow-control open:shadow-card sm:p-6"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-900 marker:content-none sm:text-base">
              {faq.question}
              <span
                aria-hidden="true"
                className="shrink-0 text-lg font-normal text-primary-600 transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-sm text-slate-500">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
