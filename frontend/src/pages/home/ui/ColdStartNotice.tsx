import { Button } from "../../../shared/ui";

import { useColdStartCheck } from "../model/useColdStartCheck";

/**
 * コールドスタート対策のローディング / リトライ UI。
 * 疎通確認中・失敗時のみ表示し、成功時は何も描画しない。
 */
export function ColdStartNotice() {
  const health = useColdStartCheck();

  if (health.isPending) {
    return (
      <div
        role="status"
        className="mx-auto flex w-fit items-center gap-2 rounded-pill border border-white/40 bg-white/10 px-4 py-2 text-sm text-white"
      >
        <span
          aria-hidden="true"
          className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
        サーバーを起動しています…初回アクセス時は数十秒かかる場合があります
      </div>
    );
  }

  if (health.isError) {
    return (
      <div
        role="alert"
        className="mx-auto flex w-fit flex-col items-center gap-2 rounded-control border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700 sm:flex-row"
      >
        <span>
          サーバーに接続できませんでした。初回起動に時間がかかっている場合があります。時間をおいて再試行してください。
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => health.refetch()}>
          再試行
        </Button>
      </div>
    );
  }

  return null;
}
