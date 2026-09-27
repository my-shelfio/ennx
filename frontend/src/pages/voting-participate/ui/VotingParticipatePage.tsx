import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import type { BallotRequestBody } from "../../../entities/voting";
import { useVotingNicknameStore } from "../../../entities/voting";
import {
  useCastBallot,
  useParticipantSession,
  usePublicVotingResults,
} from "../../../features/voting-participate";
import { cn, formatRemaining, REMAINING_REFRESH_MS, useNow } from "../../../shared/lib";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  useToast,
} from "../../../shared/ui";
import { VotingBallotForm } from "../../../widgets/voting-ballot-form";
import { VotingResultsPanel } from "../../../widgets/voting-results-panel";

const REFERENCE_NOTICE = "結果は合意形成のための参考情報であり、決議ではありません。";
/** 締切到達後、サーバー側で締切済みになるのを待ってから再取得するまでの猶予。 */
const DEADLINE_REFETCH_DELAY_MS = 1000;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP");
}

/**
 * 投票参加ページ。
 * 事前条件(有効期限内・締切前)を満たさない場合は、終了・存在しない旨を案内する。
 * ニックネーム（本名でなくてよい）の入力が必須であり主催者に開示される旨、
 * 「結果は合意形成の参考情報であり決議ではない」旨を常時表示する
 * (非機能要件「投票結果画面に...旨が常に表示されること」を参加画面でも踏襲)。
 * 重複投票の上書き判定はニックネームの完全一致で行う（端末内トークンではない）。
 * 受付中は締切までの残り時間を1分ごとに更新して表示し(24時間以内は強調)、締切時刻に
 * 達したらセッションを再取得して締切後の画面へ切り替える。
 */
export function VotingParticipatePage() {
  const { token } = useParams<{ token: string }>();
  const participantToken = token ?? "";
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedVoterName, setSubmittedVoterName] = useState("");
  const getNickname = useVotingNicknameStore((state) => state.getNickname);
  const setNickname = useVotingNicknameStore((state) => state.setNickname);

  const sessionQuery = useParticipantSession(participantToken);
  const castBallotMutation = useCastBallot();
  const publicResultsQuery = usePublicVotingResults(
    participantToken,
    sessionQuery.data?.results_available === true,
  );
  const isOpen = sessionQuery.data !== undefined && !sessionQuery.data.is_closed;
  const now = useNow(REMAINING_REFRESH_MS, isOpen);
  const openDeadline = isOpen ? sessionQuery.data?.deadline : undefined;
  const { refetch: refetchSession } = sessionQuery;

  useEffect(() => {
    if (openDeadline === undefined) {
      return undefined;
    }
    const delay = Math.max(new Date(openDeadline).getTime() - Date.now(), 0);
    const timer = setTimeout(() => {
      void refetchSession();
    }, delay + DEADLINE_REFETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [openDeadline, refetchSession]);

  if (sessionQuery.isLoading) {
    return (
      <div
        role="status"
        className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-20 text-sm text-slate-500 sm:px-6"
      >
        <span
          aria-hidden="true"
          className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600"
        />
        読み込んでいます…
      </div>
    );
  }

  if (sessionQuery.isError) {
    // 存在有無を区別しない文言(無効・期限切れ・削除済み・不正トークンを区別しない)。
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>この投票は終了したか、存在しません</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const session = sessionQuery.data;
  if (session === undefined) {
    return null;
  }
  const remaining = formatRemaining(new Date(session.deadline), now);

  if (session.is_closed && session.results_available) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{session.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            この投票は締め切られました。主催者の設定により、集計結果を公開しています。
          </p>
        </div>

        <p className="rounded-control border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          {REFERENCE_NOTICE}参加者のニックネームは公開されません。
        </p>

        {publicResultsQuery.isLoading ? (
          <p role="status" className="text-sm text-slate-500">
            結果を読み込んでいます…
          </p>
        ) : null}
        {publicResultsQuery.isError ? (
          <p role="alert" className="text-sm text-danger-700">
            結果を取得できませんでした。時間をおいて再度お試しください。
          </p>
        ) : null}
        {publicResultsQuery.data !== undefined ? (
          publicResultsQuery.data.ballot_count === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>投票はありませんでした</CardTitle>
              </CardHeader>
            </Card>
          ) : (
            <VotingResultsPanel results={publicResultsQuery.data} />
          )
        ) : null}
      </div>
    );
  }

  if (session.is_closed) {
    // 締切時刻より前に主催者が締め切った場合は、予定の締切日時とあわせてその旨を示す。
    // 判定には「締切済み」の応答を受け取った時刻を使う(残り時間表示用の現在時刻は
    // 1分ごとにしか更新されず、ページを開いたまま締切を迎えると締切前の値が残るため)。
    const closedEarly = new Date(session.deadline).getTime() > sessionQuery.dataUpdatedAt;
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>{session.title}</CardTitle>
            <CardDescription>この投票はすでに締め切られています。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-500">締切</dt>
              <dd className="text-slate-900">
                {closedEarly
                  ? `主催者が締め切りました(予定していた締切: ${formatDateTime(session.deadline)})`
                  : formatDateTime(session.deadline)}
              </dd>
              {session.ballot_count !== null ? (
                <>
                  <dt className="text-slate-500">受付件数</dt>
                  <dd className="text-slate-900">{session.ballot_count}件</dd>
                </>
              ) : null}
            </dl>
            <p className="rounded-control border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              この投票の結果は参加者向けには公開されていません。結果や今後の進め方は、投票を依頼した主催者にお問い合わせください。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>投票を受け付けました</CardTitle>
            <CardDescription>
              投票内容はニックネーム「{submittedVoterName}」として保存されました。同じ
              ニックネームで再度投票すると、前回の投票が上書きされます。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  function handleSubmit(body: BallotRequestBody) {
    castBallotMutation.mutate(
      { participantToken, ballot: body },
      {
        onSuccess: () => {
          // 重複判定はニックネームで行うため、端末内には次回入力補完用に
          // 直近のニックネームのみを保存する（判定そのものには使わない）。
          setNickname(participantToken, body.voter_name);
          setSubmittedVoterName(body.voter_name);
          setIsSubmitted(true);
        },
        onError: (error) => {
          // 締切後に送信した場合を含め、エラーメッセージを表示する
          // (ApiError.message は ProblemDetail の detail/title を反映済み)。
          toast({
            title: "投票の送信に失敗しました",
            description: error.message,
            variant: "danger",
          });
        },
      },
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{session.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>締切: {formatDateTime(session.deadline)}</span>
          <span className={cn(remaining.isUrgent && "font-medium text-warning-700")}>
            ({remaining.text})
          </span>
          {remaining.isUrgent ? <Badge variant="warning">締切間近</Badge> : null}
        </p>
      </div>

      <p className="rounded-control border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        投票にはニックネーム（本名でなくても構いません）の入力が必須です。入力した
        ニックネームは主催者に表示されます。同じニックネームで再度投票すると、前回の
        投票を上書きします。{REFERENCE_NOTICE}
      </p>

      <Card>
        <CardContent className="pt-6">
          <VotingBallotForm
            options={session.options}
            optionDescriptions={session.option_descriptions}
            method={session.method as "plurality" | "approval" | "ranking"}
            onSubmit={handleSubmit}
            isSubmitting={castBallotMutation.isPending}
            initialVoterName={getNickname(participantToken) ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}
