import { useState } from "react";
import { useParams } from "react-router-dom";

import type { BallotRequestBody } from "../../../entities/voting";
import { useVotingNicknameStore } from "../../../entities/voting";
import { useCastBallot, useParticipantSession } from "../../../features/voting-participate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, useToast } from "../../../shared/ui";
import { VotingBallotForm } from "../../../widgets/voting-ballot-form";

/**
 * 投票参加ページ。
 * 事前条件(有効期限内・締切前)を満たさない場合は、終了・存在しない旨を案内する。
 * ニックネーム（本名でなくてよい）の入力が必須であり主催者に開示される旨、
 * 「結果は合意形成の参考情報であり決議ではない」旨を常時表示する
 * (非機能要件「投票結果画面に...旨が常に表示されること」を参加画面でも踏襲)。
 * 重複投票の上書き判定はニックネームの完全一致で行う（端末内トークンではない）。
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
    // 例外フロー1a: 存在有無を区別しない文言(無効・期限切れ・削除済み・不正トークンを区別しない)。
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

  if (session.is_closed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>{session.title}</CardTitle>
            <CardDescription>この投票はすでに締め切られています。</CardDescription>
          </CardHeader>
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
          // 例外フロー4a: 締切後に送信した場合を含め、エラーメッセージを表示する
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
        <p className="mt-1 text-sm text-slate-500">
          締切: {new Date(session.deadline).toLocaleString("ja-JP")}
        </p>
      </div>

      <p className="rounded-control border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        投票にはニックネーム（本名でなくても構いません）の入力が必須です。入力した
        ニックネームは主催者に表示されます。同じニックネームで再度投票すると、前回の
        投票を上書きします。結果は合意形成のための参考情報であり、決議ではありません。
      </p>

      <Card>
        <CardContent className="pt-6">
          <VotingBallotForm
            options={session.options}
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
