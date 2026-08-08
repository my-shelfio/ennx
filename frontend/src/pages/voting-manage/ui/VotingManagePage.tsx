import { useState } from "react";
import { useParams } from "react-router-dom";

import {
  useAdminSession,
  useCloseVotingSession,
  useDeleteVotingSession,
  useVotingResults,
} from "../../../features/voting-manage";
import { buildVotingParticipateUrl } from "../../../shared/config";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, useToast } from "../../../shared/ui";
import { VotingResultsPanel } from "../../../widgets/voting-results-panel";

/**
 * 投票管理ページ。
 * 参加用・管理用 URL の再表示、締切前は「締め切って集計する」、締切後は集計結果
 * (widgets/voting-results-panel)を表示する。削除は確認の上で即時実行する。
 */
export function VotingManagePage() {
  const { token } = useParams<{ token: string }>();
  const adminToken = token ?? "";
  const { toast } = useToast();
  const [isDeleted, setIsDeleted] = useState(false);

  const sessionQuery = useAdminSession(adminToken);
  const closeMutation = useCloseVotingSession(adminToken);
  const deleteMutation = useDeleteVotingSession(adminToken);
  const resultsQuery = useVotingResults(adminToken, sessionQuery.data?.is_closed === true);

  if (isDeleted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>投票データを削除しました</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

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

  const participateUrl = `${window.location.origin}${buildVotingParticipateUrl(session.participant_token)}`;
  const manageUrl = window.location.href;

  function handleClose() {
    closeMutation.mutate(undefined, {
      onError: (error) => {
        toast({ title: "締め切りに失敗しました", description: error.message, variant: "danger" });
      },
    });
  }

  function handleDelete() {
    if (!window.confirm("この投票データを削除します。この操作は取り消せません。よろしいですか?")) {
      return;
    }
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        setIsDeleted(true);
      },
      onError: (error) => {
        toast({ title: "削除に失敗しました", description: error.message, variant: "danger" });
      },
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{session.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          締切: {new Date(session.deadline).toLocaleString("ja-JP")} ／ 投票数:{" "}
          {session.ballot_count}件
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>URL</CardTitle>
          <CardDescription>参加用 URL は参加者への配布用、管理用 URL はこのページです。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">参加用 URL</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                readOnly
                value={participateUrl}
                className="h-10 w-full min-w-0 rounded-control border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(participateUrl)}
              >
                コピー
              </Button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">管理用 URL</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                readOnly
                value={manageUrl}
                className="h-10 w-full min-w-0 rounded-control border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(manageUrl)}
              >
                コピー
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>投票者</CardTitle>
          <CardDescription>
            投票済みのニックネーム一覧です。同一ニックネームでの再投票は上書きされます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {session.voters.length === 0 ? (
            <p className="text-sm text-slate-500">まだ投票はありません。</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {session.voters.map((voter, index) => (
                <li key={`${voter}-${index}`}>
                  <Badge variant="neutral">{voter}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!session.is_closed ? (
        <Card>
          <CardHeader>
            <CardTitle>集計する</CardTitle>
            <CardDescription>
              締め切ると投票の受け付けを停止し、集計結果と性質レポートを表示します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={handleClose} disabled={closeMutation.isPending}>
              {closeMutation.isPending ? "締め切っています…" : "締め切って集計する"}
            </Button>
          </CardContent>
        </Card>
      ) : resultsQuery.data !== undefined ? (
        session.ballot_count === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>投票がまだありません</CardTitle>
            </CardHeader>
          </Card>
        ) : (
          <>
            {/* 非機能要件「投票結果画面に...旨が常に表示されること」への対応
                （レビュー指摘対応: widgets/voting-results-panel 側のコメントは
                「呼び出し元ページで担保する」前提だったが、実際には表示されていなかった）。 */}
            <p className="rounded-control border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              結果は合意形成のための参考情報であり、決議ではありません。
            </p>
            <VotingResultsPanel results={resultsQuery.data} />
          </>
        )
      ) : resultsQuery.isLoading ? (
        <p className="text-sm text-slate-500">集計結果を読み込んでいます…</p>
      ) : resultsQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>集計結果の取得に失敗しました</CardTitle>
            <CardDescription>
              {resultsQuery.error.message}
              {"　"}
              <button
                type="button"
                className="font-medium text-primary-700 underline"
                onClick={() => void resultsQuery.refetch()}
              >
                再試行する
              </button>
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>投票データを削除する</CardTitle>
          <CardDescription>
            投票セッションと全投票内容を即時削除します。この操作は取り消せません。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            この投票を削除する
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
