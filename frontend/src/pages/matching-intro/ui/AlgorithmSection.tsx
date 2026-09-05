import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/ui";

import { ALGORITHM_CARDS } from "../lib/algorithmCards";

/**
 * 配属マッチング導入ページのアルゴリズム解説セクション。
 * 制約の種類ごとに選べるアルゴリズム 3 種を、モジュール共通の骨格に差し込む形で提示する。
 */
export function AlgorithmSection() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
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
  );
}
