import { useState, type FormEvent } from "react";

import {
  buildDeadlineIso,
  buildOptionDescriptions,
  MAX_DEADLINE_DAYS,
  validateVotingCreateForm,
  VOTING_METHOD_INFO,
  VOTING_METHODS,
} from "../../../entities/voting";
import type {
  VotingCreateFormErrors,
  VotingCreateFormValues,
  VotingMethod,
  VotingSessionCreated,
} from "../../../entities/voting";
import { useCreateVotingSession } from "../../../features/voting-create";
import { cn } from "../../../shared/lib";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  useToast,
} from "../../../shared/ui";

import {
  DECISION_GOAL_OPTIONS,
  recommendMethod,
  type DecisionGoal,
} from "../lib/recommendMethod";

import { FieldErrorText } from "./FieldErrorText";
import { OptionListField } from "./OptionListField";

const DEADLINE_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

const INITIAL_VALUES: VotingCreateFormValues = {
  title: "",
  options: ["", ""],
  optionDescriptions: ["", ""],
  method: "",
  deadlineDays: MAX_DEADLINE_DAYS,
  publishResults: false,
};

export interface VotingCreateFormProps {
  /** 作成成功時に呼ばれる(トークン・締切を含む作成結果を渡す)。遷移はページ側に委ねる。 */
  onCreated: (created: VotingSessionCreated) => void;
  /** フォームの初期値(既存の投票を複製する場合など)。省略時は空のフォームで始める。 */
  initialValues?: VotingCreateFormValues;
}

/**
 * 投票作成フォーム。
 * クライアント側検証(`validateVotingCreateForm`)で明らかな不備を弾いた上で
 * `POST /api/v1/voting/sessions` を呼び出す(サーバー側エラーは該当フィールド直下に表示する)。
 */
export function VotingCreateForm({ onCreated, initialValues }: VotingCreateFormProps) {
  const [values, setValues] = useState<VotingCreateFormValues>(initialValues ?? INITIAL_VALUES);
  const [errors, setErrors] = useState<VotingCreateFormErrors>({});
  const [decisionGoal, setDecisionGoal] = useState<DecisionGoal | null>(null);
  const recommendation = decisionGoal !== null ? recommendMethod(decisionGoal) : null;
  const { toast } = useToast();
  const createMutation = useCreateVotingSession();

  /** 「どう決めたいか」の回答に応じて推奨方式を既定選択する（その後の方式の変更は自由）。 */
  function handleDecisionGoalSelect(goal: DecisionGoal) {
    setDecisionGoal(goal);
    const { method } = recommendMethod(goal);
    setValues((prev) => ({ ...prev, method }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateVotingCreateForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const trimmedOptions = values.options.map((option) => option.trim());
    createMutation.mutate(
      {
        title: values.title.trim(),
        options: trimmedOptions,
        option_descriptions: buildOptionDescriptions(values.optionDescriptions),
        method: values.method as VotingMethod,
        deadline: buildDeadlineIso(values.deadlineDays),
        publish_results: values.publishResults,
      },
      {
        onSuccess: (created) => {
          onCreated(created);
        },
        onError: (error) => {
          // 例外フロー4a: エラーメッセージ表示・入力内容は保持(再試行可能)。
          toast({
            title: "投票の作成に失敗しました",
            description: error.message,
            variant: "danger",
          });
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>投票を作成する</CardTitle>
        <CardDescription>
          タイトル・選択肢・投票方式・締切を設定してください。ログイン・登録は不要です。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="voting-title" className="block text-sm font-medium text-slate-700">
              タイトル
            </label>
            <input
              id="voting-title"
              type="text"
              value={values.title}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, title: event.target.value }))
              }
              aria-invalid={errors.title !== undefined}
              aria-describedby={errors.title !== undefined ? "voting-title-error" : undefined}
              className="mt-1 h-10 w-full min-w-0 rounded-control border border-slate-300 px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              placeholder="例: 来期の懇親会の会場"
            />
            <FieldErrorText id="voting-title-error" message={errors.title} />
          </div>

          <OptionListField
            options={values.options}
            descriptions={values.optionDescriptions}
            onChange={({ options, descriptions }) =>
              setValues((prev) => ({ ...prev, options, optionDescriptions: descriptions }))
            }
            error={errors.options}
            descriptionError={errors.optionDescriptions}
          />

          <fieldset className="min-w-0">
            <legend className="block text-sm font-medium text-slate-700">
              どう決めたいですか？（任意）
            </legend>
            <p className="mt-1 text-xs text-slate-500">
              選ぶと、向いている投票方式が選択されます。方式は下で自由に変更できます。
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {DECISION_GOAL_OPTIONS.map(({ goal, label }) => (
                <button
                  key={goal}
                  type="button"
                  aria-pressed={decisionGoal === goal}
                  className={cn(
                    "min-h-11 rounded-control border px-4 py-2 text-left text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2",
                    decisionGoal === goal
                      ? "border-primary-400 bg-primary-50 text-primary-700"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                  onClick={() => handleDecisionGoalSelect(goal)}
                >
                  {label}
                </button>
              ))}
            </div>
            {recommendation !== null ? (
              <p
                role="status"
                className="mt-3 rounded-control border border-primary-200 bg-primary-50 px-4 py-3 text-xs text-primary-800"
              >
                おすすめ: {VOTING_METHOD_INFO[recommendation.method].label}。{recommendation.reason}
              </p>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="block text-sm font-medium text-slate-700">投票方式</legend>
            <div className="mt-2 flex flex-col gap-3">
              {VOTING_METHODS.map((method) => {
                const info = VOTING_METHOD_INFO[method];
                const isRecommended = recommendation?.method === method;
                return (
                  <label
                    key={method}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-control border p-3",
                      values.method === method
                        ? "border-primary-400 bg-primary-50"
                        : "border-slate-200",
                    )}
                  >
                    <input
                      type="radio"
                      name="voting-method"
                      value={method}
                      checked={values.method === method}
                      onChange={() => setValues((prev) => ({ ...prev, method }))}
                      className="mt-1"
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                        {info.label}
                        {isRecommended ? <Badge variant="primary">おすすめ</Badge> : null}
                      </span>
                      <span className="block text-xs text-slate-500">{info.description}</span>
                      <span className="block text-xs text-slate-600">
                        向いている場面: {info.suitedFor}
                      </span>
                      <span className="block text-xs text-slate-600">
                        参加者の手間: {info.effort}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <FieldErrorText message={errors.method} />
          </fieldset>

          <div>
            <label htmlFor="voting-deadline" className="block text-sm font-medium text-slate-700">
              締切(本日から何日後か・最長7日)
            </label>
            <select
              id="voting-deadline"
              value={values.deadlineDays}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, deadlineDays: Number(event.target.value) }))
              }
              aria-invalid={errors.deadlineDays !== undefined}
              aria-describedby={
                errors.deadlineDays !== undefined ? "voting-deadline-error" : undefined
              }
              className="mt-1 h-10 w-full min-w-0 rounded-control border border-slate-300 px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              {DEADLINE_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days}日後
                </option>
              ))}
            </select>
            <FieldErrorText id="voting-deadline-error" message={errors.deadlineDays} />
          </div>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={values.publishResults}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, publishResults: event.target.checked }))
              }
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700">
                締切後に参加者へ結果を公開する
              </span>
              <span className="block text-xs text-slate-500">
                締切後(または管理画面で締め切った後)、参加者も参加用 URL から集計結果・方式別の比較・性質レポートを閲覧できます。ニックネームの一覧は表示されません。
              </span>
            </span>
          </label>

          <p className="rounded-control border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            発行される参加用 URL を知る人は誰でも投票に参加できます。
            {values.publishResults ? "締切後は同じ URL から結果も閲覧できます。" : ""}
            投票データは作成から最長7日で自動的に削除されます。
          </p>

          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "作成しています…" : "投票を作成する"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
