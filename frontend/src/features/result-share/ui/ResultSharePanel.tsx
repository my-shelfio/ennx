import { useState } from "react";

import type { MatchingInput } from "../../../entities/matching";
import type { IssuedResultShare } from "../../../entities/result-share";
import {
  activeShares,
  DEFAULT_RETENTION_DAYS,
  describeDeletion,
  estimateExpiresAt,
  RETENTION_DAY_OPTIONS,
  useIssuedResultShareStore,
} from "../../../entities/result-share";
import { ApiError } from "../../../shared/api";
import { buildSharedResultUrl } from "../../../shared/config";
import { REMAINING_REFRESH_MS, useNow } from "../../../shared/lib";
import { Button, useToast } from "../../../shared/ui";
import { useCreateResultShare } from "../model/useCreateResultShare";
import { useDeleteResultShare } from "../model/useDeleteResultShare";

export interface ResultSharePanelProps {
  input: MatchingInput;
}

function sharedResultUrl(viewToken: string): string {
  return `${window.location.origin}${buildSharedResultUrl(viewToken)}`;
}

/**
 * 発行ダイアログの中身。保持期間の選択・注意事項・発行ボタンと、このブラウザで
 * 発行した（有効期限内の）閲覧用 URL の一覧（コピー・削除）を表示する。
 * ダイアログを開くたびにマウントされるため、現在時刻・発行状態は開いた時点から数える。
 */
export function ResultSharePanel({ input }: ResultSharePanelProps) {
  const { toast } = useToast();
  const now = useNow(REMAINING_REFRESH_MS);
  const [retentionDays, setRetentionDays] = useState<number>(DEFAULT_RETENTION_DAYS);
  const [lastIssuedToken, setLastIssuedToken] = useState<string | null>(null);
  const shares = useIssuedResultShareStore((state) => state.shares);
  const addShare = useIssuedResultShareStore((state) => state.addShare);
  const removeShare = useIssuedResultShareStore((state) => state.removeShare);
  const createMutation = useCreateResultShare();
  const deleteMutation = useDeleteResultShare();
  const issuedShares = activeShares(shares, now);

  function handleCreate() {
    createMutation.mutate(
      { input, retention_days: retentionDays },
      {
        onSuccess: (created) => {
          addShare({
            viewToken: created.view_token,
            deleteToken: created.delete_token,
            createdAt: created.created_at,
            expiresAt: created.expires_at,
            summary: `社員 ${input.proposer_prefs.length} 名・部署 ${input.capacities.length} 部署`,
          });
          setLastIssuedToken(created.view_token);
          toast({ title: "閲覧用 URL を発行しました", variant: "neutral" });
        },
        onError: (error) => {
          toast({ title: "発行に失敗しました", description: error.message, variant: "danger" });
        },
      },
    );
  }

  async function handleCopy(share: IssuedResultShare) {
    try {
      await navigator.clipboard.writeText(sharedResultUrl(share.viewToken));
      toast({ title: "閲覧用 URL をコピーしました", variant: "neutral" });
    } catch {
      toast({
        title: "閲覧用 URL のコピーに失敗しました",
        description: "ブラウザのクリップボード機能を利用できませんでした。URL を選択してコピーしてください。",
        variant: "danger",
      });
    }
  }

  function handleDelete(share: IssuedResultShare) {
    if (
      !window.confirm(
        "この閲覧用 URL を削除します。URL を開いても結果は表示されなくなります。よろしいですか?",
      )
    ) {
      return;
    }
    deleteMutation.mutate(share.deleteToken, {
      onSuccess: () => {
        removeShare(share.viewToken);
        toast({ title: "閲覧用 URL を削除しました", variant: "neutral" });
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 404) {
          // 期限切れ等で既にサーバーに存在しない。一覧からも取り除く。
          removeShare(share.viewToken);
          toast({
            title: "既に削除されています",
            description: error.message,
            variant: "neutral",
          });
          return;
        }
        toast({ title: "削除に失敗しました", description: error.message, variant: "danger" });
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          保持期間
          <select
            value={retentionDays}
            onChange={(event) => setRetentionDays(Number(event.target.value))}
            className="h-10 w-40 rounded-control border border-slate-300 bg-white px-2 text-sm text-slate-900"
          >
            {RETENTION_DAY_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days}日{days === DEFAULT_RETENTION_DAYS ? "（既定）" : ""}
              </option>
            ))}
          </select>
        </label>
        <ul className="list-disc space-y-1 rounded-control border border-warning-100 bg-warning-50 py-3 pl-8 pr-4 text-sm text-slate-700">
          <li>URL を知る者は誰でも閲覧できます（ログイン不要）。</li>
          <li>社員名・部署名・希望順位が含まれます。取り扱いにご注意ください。</li>
          <li>
            {describeDeletion(estimateExpiresAt(now, retentionDays), now)}
            。発行後はいつでも削除できます。
          </li>
          <li>サーバーには入力のみを保存し、結果は閲覧時に再計算します。</li>
        </ul>
        <div>
          <Button type="button" onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? "発行しています…" : "閲覧用 URL を発行"}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">発行済みの閲覧用 URL</h3>
          <p className="mt-1 text-xs text-slate-500">
            このブラウザで発行したものです。削除に必要な情報はこのブラウザにのみ保存されるため、
            ブラウザのデータを消去すると期限前に削除できなくなります。
          </p>
        </div>
        {issuedShares.length === 0 ? (
          <p className="text-sm text-slate-500">発行済みの閲覧用 URL はありません。</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {issuedShares.map((share) => (
              <li
                key={share.viewToken}
                className={`flex flex-col gap-2 rounded-control border px-3 py-3 ${
                  share.viewToken === lastIssuedToken
                    ? "border-primary-300 bg-primary-50"
                    : "border-slate-200"
                }`}
              >
                <p className="text-xs text-slate-500">
                  {share.summary} ／ 発行: {new Date(share.createdAt).toLocaleString("ja-JP")}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    aria-label="閲覧用 URL"
                    value={sharedResultUrl(share.viewToken)}
                    onFocus={(event) => event.currentTarget.select()}
                    className="h-10 w-full min-w-0 rounded-control border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900"
                  />
                  <Button type="button" variant="outline" onClick={() => void handleCopy(share)}>
                    コピー
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDelete(share)}
                    disabled={deleteMutation.isPending}
                  >
                    削除
                  </Button>
                </div>
                <p className="text-xs text-slate-600">
                  {describeDeletion(new Date(share.expiresAt), now)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
