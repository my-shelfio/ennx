import { ROUTES } from "../../../shared/config";

export interface ProblemCard {
  key: string;
  /** 利用者が抱えている困りごと（見出し）。 */
  problem: string;
  /** その困りごとを ennx がどう扱うか。 */
  solution: string;
  /** 対応するモジュールの導入ページへの導線。 */
  ctaLabel: string;
  href: string;
}

/**
 * ホーム画面「どんな課題を解決するか」セクションのカードデータ。
 * モジュール名ではなく困りごとを入口にして、対応するモジュールの導入ページへ導く。
 * モジュールを追加する際は、この配列に 1 件足すだけで済む構造にする。
 */
export const PROBLEM_CARDS: readonly ProblemCard[] = [
  {
    key: "matching",
    problem: "希望を集めたのに、誰をどこに配属するか決めきれない",
    solution:
      "双方の希望順位と定員から、入れ替えの余地がない配属案を作ります。決定の過程をたどれるため、結果の理由を説明できます。",
    ctaLabel: "配属マッチングで解決する",
    href: ROUTES.matching.intro,
  },
  {
    key: "assignment",
    problem: "配る側に優劣の基準がなく、公平に配れない",
    solution:
      "希望順位だけで配属される確率を計算し、実際に配るためのくじへ分解します。早い者勝ちや裁量に頼らずに済みます。",
    ctaLabel: "割り当てで解決する",
    href: ROUTES.assignment.intro,
  },
  {
    key: "voting",
    problem: "多数決で決めたが、その結論に納得が得られない",
    solution:
      "投票ルールごとの結果と、そのルールが満たす性質を並べて示します。ルールの選び方が結果をどう変えるかが分かります。",
    ctaLabel: "投票・合意形成で解決する",
    href: ROUTES.voting.intro,
  },
] as const;
