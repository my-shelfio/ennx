import { useState } from "react";
import { Link } from "react-router-dom";

import type { VotingSessionCreated } from "../../../entities/voting";
import { buildVotingManageUrl, buildVotingParticipateUrl } from "../../../shared/config";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/ui";
import { VotingCreateForm } from "../../../widgets/voting-create-form";

/**
 * 投票作成ページ。
 * 作成成功後は同ページ内で参加用・管理用 URL と有効期限を、注意書きとともに表示する。
 * 管理用 URL への遷移はリンクとして提供し、ここから管理画面(VotingManagePage)へ進める。
 */
export function VotingCreatePage() {
  const [created, setCreated] = useState<VotingSessionCreated | null>(null);

  if (created !== null) {
    const participateUrl = `${window.location.origin}${buildVotingParticipateUrl(created.participant_token)}`;

    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>投票を作成しました</CardTitle>
            <CardDescription>
              締切: {new Date(created.deadline).toLocaleString("ja-JP")} ／ データの自動削除:{" "}
              {new Date(created.expires_at).toLocaleString("ja-JP")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <p className="rounded-control border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              この URL を知る人は誰でも参加できます。チャットツール等で参加者に配布してください(配布は
              ennx の外で行います)。
            </p>

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

            <Button asChild>
              <Link to={buildVotingManageUrl(created.admin_token)}>管理画面を開く</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">投票・合意形成</h1>
        <p className="mt-1 text-sm text-slate-500">
          複数案から1つを選ぶ意思決定を、投票ルールごとの結果と性質つきで可視化します。
        </p>
      </div>
      <VotingCreateForm onCreated={setCreated} />
    </div>
  );
}
