import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/ui";

import { MODULE_INTRO_STEP_TITLES } from "../lib/steps";
import type { ModuleIntroStepDescriptions } from "../lib/steps";

/** 導入ページから実行画面へ送る CTA。 */
export interface ModuleIntroCta {
  label: string;
  to: string;
  variant?: "primary" | "outline";
}

/** モジュールが理論的に保証する性質。 */
export interface ModuleIntroProperty {
  name: string;
  description: string;
}

export interface ModuleIntroProps {
  /** モジュール名（ホームのカード表記・グローバルナビと一致させる）。 */
  title: string;
  /** モジュールが何をするかの要約。 */
  lead: string;
  /** 解決する課題。 */
  problems: readonly string[];
  /** 使う場面の具体例。 */
  scenes: readonly string[];
  /** 共通4ステップの説明文。 */
  stepDescriptions: ModuleIntroStepDescriptions;
  /** 保証される性質。 */
  properties: readonly ModuleIntroProperty[];
  /** 実行画面への導線（先頭を主 CTA として扱う）。 */
  ctas: readonly ModuleIntroCta[];
  /** モジュール固有の追加セクション（例: マッチングのアルゴリズム解説）。 */
  children?: ReactNode;
}

/**
 * 各モジュールの導入ページで共通に使う骨格。
 * 「解決する課題 → 使う場面 → 進め方の4ステップ → 保証される性質 → 実行画面への CTA」を
 * この順で描画する。モジュール固有の解説は `children` として最後の CTA の手前に差し込む。
 *
 * モジュール固有の説明をホームではなく各導入ページへ集約するための共通部品であり、
 * モジュールが増えても導入ページを1枚追加するだけで済む構造にする。
 */
export function ModuleIntro({
  title,
  lead,
  problems,
  scenes,
  stepDescriptions,
  properties,
  ctas,
  children,
}: ModuleIntroProps) {
  return (
    <div className="flex flex-col">
      <section className="bg-gradient-brand px-4 py-16 text-center sm:px-6 sm:py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className="max-w-2xl text-sm text-primary-50 sm:text-base">{lead}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {ctas.map((cta) => (
              <Button
                key={cta.to}
                asChild
                variant={cta.variant === "outline" ? "outline" : "secondary"}
                size="lg"
              >
                <Link to={cta.to}>{cta.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">解決する課題</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {problems.map((problem) => (
            <li
              key={problem}
              className="rounded-control border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-control"
            >
              {problem}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-slate-50 px-4 py-14 sm:px-6">
        <div className="mx-auto w-full max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-slate-900">使う場面</h2>
          <ul className="mt-8 flex flex-wrap justify-center gap-2">
            {scenes.map((scene) => (
              <li
                key={scene}
                className="rounded-pill bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700"
              >
                {scene}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">進め方</h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          どのモジュールも同じ4ステップで進みます。
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULE_INTRO_STEP_TITLES.map((stepTitle, index) => (
            <li
              key={stepTitle}
              className="flex flex-col gap-2 rounded-control border border-slate-200 bg-white p-4 shadow-control"
            >
              <span className="w-fit rounded-pill bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                STEP {index + 1}
              </span>
              <span className="text-sm font-semibold text-slate-900">{stepTitle}</span>
              <p className="text-xs text-slate-500">{stepDescriptions[index]}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-slate-50 px-4 py-14 sm:px-6">
        <div className="mx-auto w-full max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-slate-900">保証される性質</h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            結果の良し悪しではなく、理論として何が保証されるかを示します。
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <Card key={property.name}>
                <CardHeader>
                  <CardTitle>{property.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{property.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {children}

      <section className="mx-auto w-full max-w-3xl px-4 pb-16 pt-14 sm:px-6">
        <div className="flex flex-col items-center gap-4 rounded-card border border-slate-200 bg-white p-8 text-center shadow-card">
          <h2 className="text-xl font-semibold text-slate-900">{title}を使ってみる</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            {ctas.map((cta) => (
              <Button
                key={cta.to}
                asChild
                variant={cta.variant === "outline" ? "outline" : "primary"}
                size="lg"
              >
                <Link to={cta.to}>{cta.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
