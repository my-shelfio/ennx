import type { VotingMethod } from "../../../entities/voting";

/** 「どう決めたいか」の回答キー。 */
export type DecisionGoal = "quick" | "narrow" | "priority";

export interface DecisionGoalOption {
  goal: DecisionGoal;
  /** 回答ボタンに表示する文言。 */
  label: string;
}

/** 作成画面で提示する「どう決めたいですか？」の選択肢（表示順）。 */
export const DECISION_GOAL_OPTIONS: readonly DecisionGoalOption[] = [
  { goal: "quick", label: "1案をすばやく選びたい" },
  { goal: "narrow", label: "許容できる案を絞りたい・票割れを避けたい" },
  { goal: "priority", label: "優先順位まで知りたい・方式間の比較もしたい" },
];

export interface MethodRecommendation {
  method: VotingMethod;
  /** 推奨理由（平易な場面説明）。 */
  reason: string;
}

const RECOMMENDATIONS: Record<DecisionGoal, MethodRecommendation> = {
  quick: {
    method: "plurality",
    reason: "参加者は案を1つ選ぶだけなので、短時間で回答が集まります。",
  },
  narrow: {
    method: "approval",
    reason:
      "賛成できる案をいくつでも選べるため、似た案があっても票が割れにくく、多くの人が受け入れられる案が分かります。",
  },
  priority: {
    method: "ranking",
    reason:
      "全案に順位を付けてもらうため、優先順位まで分かります。多数決・コンドルセ方式で集計した場合との比較も確認できます。",
  },
};

/**
 * 「どう決めたいか」の回答から推奨する投票方式と推奨理由を返す。
 * 推奨は作成フォームの既定選択に反映するだけで、最終的な方式の選択は主催者に委ねる。
 */
export function recommendMethod(goal: DecisionGoal): MethodRecommendation {
  return RECOMMENDATIONS[goal];
}
