import { useState, type FormEvent } from "react";

import {
  buildDeadlineIso,
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
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  useToast,
} from "../../../shared/ui";

import { FieldErrorText } from "./FieldErrorText";
import { OptionListField } from "./OptionListField";

const DEADLINE_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

const INITIAL_VALUES: VotingCreateFormValues = {
  title: "",
  options: ["", ""],
  method: "",
  deadlineDays: 7,
};

export interface VotingCreateFormProps {
  /** 作成成功時に呼ばれる(トークン・締切を含む作成結果を渡す)。遷移はページ側に委ねる。 */
  onCreated: (created: VotingSessionCreated) => void;
}

/**
 * 投票作成フォーム。
 * クライアント側検証(`validateVotingCreateForm`)で明らかな不備を弾いた上で
 * `POST /api/v1/voting/sessions` を呼び出す(サーバー側エラーは該当フィールド直下に表示する)。
 */
export function VotingCreateForm({ onCreated }: VotingCreateFormProps) {
  const [values, setValues] = useState<VotingCreateFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<VotingCreateFormErrors>({});
  const { toast } = useToast();
  const createMutation = useCreateVotingSession();

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
        method: values.method as VotingMethod,
        deadline: buildDeadlineIso(values.deadlineDays),
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
            onChange={(options) => setValues((prev) => ({ ...prev, options }))}
            error={errors.options}
          />

          <fieldset>
            <legend className="block text-sm font-medium text-slate-700">投票方式</legend>
            <div className="mt-2 flex flex-col gap-3">
              {VOTING_METHODS.map((method) => {
                const info = VOTING_METHOD_INFO[method];
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
                    <span>
                      <span className="block text-sm font-medium text-slate-900">
                        {info.label}
                      </span>
                      <span className="block text-xs text-slate-500">{info.description}</span>
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

          <p className="rounded-control border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            発行される参加用 URL を知る人は誰でも投票に参加できます。投票データは作成から最長7日で自動的に削除されます。
          </p>

          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "作成しています…" : "投票を作成する"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
