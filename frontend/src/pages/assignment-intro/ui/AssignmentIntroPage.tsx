import { useEffect } from "react";

import { ROUTES, withSampleQuery } from "../../../shared/config";
import { ModuleIntro } from "../../../widgets/module-intro";

/**
 * 割り当ての導入ページ（"/assignment"）。
 * 実行画面は下位パス（"/assignment/run"）にあり、このページからのみ説明を経由して入る。
 * 移設前のブックマークはこの導入ページに着地する（実行画面へのリダイレクトは行わない）。
 */
export function AssignmentIntroPage() {
  useEffect(() => {
    document.title = "割り当て | ennx";
  }, []);

  return (
    <ModuleIntro
      title="割り当て"
      lead="部署の側で候補者に順位をつけられない配分を、希望順位だけで公平に決めます。結果は「配属される確率」と、それを実際に配るためのくじの形で示します。"
      problems={[
        "配る側に優劣をつける基準がなく、希望が重なったときに決められない。",
        "「早い者勝ち」や担当者の裁量で配ってしまい、不公平だと言われる。",
        "抽選で決めたが、その配り方が妥当だったのかを説明できない。",
        "全員の希望を眺めても、どの配り方が一番マシなのか判断できない。",
      ]}
      scenes={["席替え・座席割り当て", "当番の持ち回り", "案件・タスクのアサイン", "研修枠の配分"]}
      stepDescriptions={[
        "枠の数と受け入れ人数、参加者の希望順位・NG ペアを 1 画面で入力します。",
        "PS メカニズムで期待割当（配属される確率）を計算し、そこから抽選を実行します。",
        "期待割当・抽選結果・くじの全項に加え、連続時間の消費過程を再生して確認できます。",
        "結果とくじを CSV / JSON で書き出し、シードを共有して同じ配分を再現できます。",
      ]}
      properties={[
        {
          name: "順序効率性",
          description:
            "確率の交換によって全員を今より良くする配り方が存在しない、という意味で無駄がありません。",
        },
        {
          name: "無羨望性",
          description:
            "自分の確率より他人の確率のほうが良い、と全員が言えない配分になります。",
        },
        {
          name: "くじへの分解",
          description:
            "計算した確率を、実際に配れる割り当ての組み合わせ（くじ）へ厳密に分解します。上限制約はどの項でも守られます。",
        },
      ]}
      ctas={[
        { label: "割り当てを始める", to: ROUTES.assignment.run },
        {
          label: "サンプルデータで試す",
          to: withSampleQuery(ROUTES.assignment.run),
          variant: "outline",
        },
      ]}
    />
  );
}
