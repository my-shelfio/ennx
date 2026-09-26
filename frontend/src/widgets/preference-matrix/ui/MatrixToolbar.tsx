import { useState } from "react";

import { Button, Dialog } from "../../../shared/ui";

type BulkAction = "fill-all" | "random-empty" | "random-all";

export interface MatrixToolbarProps {
  /** 行列の名前（例: "社員 → 部署"）。確認ダイアログの文言に使う。 */
  matrixLabel: string;
  /** 未入力の行が 1 行以上あるか（「ランダム生成（未入力の行）」の活性条件）。 */
  hasEmptyRow: boolean;
  /** 全列が埋まっていない行が 1 行以上あるか（「残りを自動補完（全行）」の活性条件）。 */
  hasIncompleteRow: boolean;
  onFillAll: () => void;
  onRandomizeEmpty: () => void;
  onRandomizeAll: () => void;
}

const ACTION_COPY: Record<BulkAction, { title: string; description: string; confirm: string }> = {
  "fill-all": {
    title: "残りを自動補完（全行）",
    description:
      "すべての行について、まだ選んでいない相手を一覧の順に末尾の希望順位へ追加します。入力済みの希望順は変わりません。",
    confirm: "全行を補完する",
  },
  "random-empty": {
    title: "ランダム生成（未入力の行）",
    description:
      "1件も選んでいない行を、ランダムな希望順位で埋めます。入力済み・入力途中の行は変わりません。",
    confirm: "未入力の行を生成する",
  },
  "random-all": {
    title: "ランダム生成（全行を上書き）",
    description:
      "すべての行をランダムな希望順位で上書きします。入力済みの内容は失われ、元に戻せません。",
    confirm: "全行を上書きする",
  },
};

/**
 * 選好行列 1 つ分の一括操作ツールバー（残りを自動補完・ランダム生成）。
 * 複数行をまとめて書き換える操作のため、実行前に確認ダイアログを挟む。
 * モバイル幅ではボタンを折り返して表示する。
 */
export function MatrixToolbar({
  matrixLabel,
  hasEmptyRow,
  hasIncompleteRow,
  onFillAll,
  onRandomizeEmpty,
  onRandomizeAll,
}: MatrixToolbarProps) {
  const [pending, setPending] = useState<BulkAction | null>(null);

  function handleConfirm() {
    if (pending === "fill-all") {
      onFillAll();
    } else if (pending === "random-empty") {
      onRandomizeEmpty();
    } else if (pending === "random-all") {
      onRandomizeAll();
    }
    setPending(null);
  }

  const copy = pending === null ? null : ACTION_COPY[pending];

  return (
    <div className="flex flex-wrap gap-2" role="toolbar" aria-label={`${matrixLabel}の一括操作`}>
      <Button
        type="button"
        variant="outline"
        size={null}
        className="h-11 px-3 text-sm"
        disabled={!hasIncompleteRow}
        onClick={() => setPending("fill-all")}
      >
        残りを自動補完（全行）
      </Button>
      <Button
        type="button"
        variant="outline"
        size={null}
        className="h-11 px-3 text-sm"
        disabled={!hasEmptyRow}
        onClick={() => setPending("random-empty")}
      >
        ランダム生成（未入力の行）
      </Button>
      <Button
        type="button"
        variant="ghost"
        size={null}
        className="h-11 px-3 text-sm"
        onClick={() => setPending("random-all")}
      >
        ランダム生成（全行を上書き）
      </Button>

      <Dialog
        open={copy !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
          }
        }}
        title={copy === null ? "" : `${matrixLabel}: ${copy.title}`}
      >
        {copy !== null ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-700">{copy.description}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPending(null)}>
                キャンセル
              </Button>
              <Button
                type="button"
                variant={pending === "random-all" ? "danger" : "primary"}
                onClick={handleConfirm}
              >
                {copy.confirm}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
