import { useEffect } from "react";

import { ROUTES, withSampleQuery } from "../../../shared/config";
import { ModuleIntro } from "../../../widgets/module-intro";

import { SAMPLE_KEYS } from "../lib/sampleKeys";

import { AlgorithmSection } from "./AlgorithmSection";
import { SampleSection } from "./SampleSection";

/**
 * 配属マッチングの導入ページ（"/matching"）。
 * 共通骨格（ModuleIntro）にアルゴリズム 3 種の解説とサンプル一覧を差し込み、設定ウィザードへ送る。
 * 主 CTA の「サンプルデータで試す」は既定サンプル（"?sample=1"）を、性質・アルゴリズムごとの
 * 導線はそれぞれの現象が起きるサンプル（"?sample=<キー>"）を読み込む。
 */
export function MatchingIntroPage() {
  useEffect(() => {
    document.title = "配属マッチング | ennx";
  }, []);

  return (
    <ModuleIntro
      title="配属マッチング"
      lead="部署と社員の双方が相手に順位をつける配属を、安定性が理論的に保証された形で決めます。決定の過程はステップ再生で確認できます。"
      problems={[
        "希望を集めたものの、誰をどこに配属するか決めきれない。",
        "調整の結果が「なぜその配属なのか」を説明できない。",
        "定員や地域ごとの上限を守った配属を手作業で組むのが難しい。",
        "後から「入れ替えたほうが両者とも得だった」組み合わせが見つかる。",
      ]}
      scenes={[
        "新卒・中途の部署配属",
        "研修医マッチング",
        "ゼミ・研究室配属",
        "プロジェクトへの人員配置",
      ]}
      stepDescriptions={[
        "部署数・社員数と定員・制約を設定し、双方の希望順位を入力します。",
        "制約に合ったアルゴリズム（DA / FDA / CA）で配属を計算します。",
        "配属マップと性質バッジで結果を確認し、ステップ再生で決定過程をたどれます。",
        "結果と過程を CSV / JSON で書き出し、関係者への説明に使えます。",
      ]}
      properties={[
        {
          name: "安定性",
          description:
            "「両者とも今より良くなる入れ替え」が存在しない配属になります。後からの不満の申し立てに理論で答えられます。",
          sampleLink: {
            label: "安定な配属のサンプルで試す",
            to: withSampleQuery(ROUTES.matching.setup, SAMPLE_KEYS.residency),
          },
        },
        {
          name: "個人合理性",
          description:
            "希望に挙げていない部署へ勝手に配属されることはありません。",
          sampleLink: {
            label: "定員不足（未配属）のサンプルで試す",
            to: withSampleQuery(ROUTES.matching.setup, SAMPLE_KEYS.unmatched),
          },
        },
        {
          name: "定員・上限の遵守",
          description:
            "部署ごとの定員に加え、地域上限や予算・属性人数といった複合的な上限制約も満たします。",
          sampleLink: {
            label: "地域上限のサンプルで試す",
            to: withSampleQuery(ROUTES.matching.setup, SAMPLE_KEYS.regionalCap),
          },
        },
      ]}
      ctas={[
        { label: "マッチングを始める", to: ROUTES.matching.setup },
        {
          label: "サンプルデータで試す",
          to: withSampleQuery(ROUTES.matching.setup),
          variant: "outline",
        },
      ]}
    >
      <AlgorithmSection />
      <SampleSection />
    </ModuleIntro>
  );
}
