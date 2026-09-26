import type { RankCell, RowValidation } from "../../../entities/matching";
import {
  filledColumnsInRankOrder,
  fillRemaining,
  isRowComplete,
  rowFromOrderedColumns,
} from "../../../entities/matching";
import { Button } from "../../../shared/ui";
import { cn } from "../../../shared/lib";
import {
  focusFirstCellInRow,
  gridCellAttributes,
  handleGridKeyDown,
  suppressArrowKeySelection,
} from "../lib/keyboardNavigation";

export interface PreferencePulldownRowProps {
  /** 行の対象者名（例: 社員名・部署名）。 */
  rowLabel: string;
  /** 相手（列）のラベル一覧。プルダウンの選択肢になる。 */
  counterpartLabels: readonly string[];
  row: readonly RankCell[];
  validation: RowValidation;
  onChangeRow: (nextRow: RankCell[]) => void;
  /** 行の DOM id に使う接頭辞（例: "proposer" / "receiver"）。 */
  rowIdPrefix: string;
  rowIndex: number;
  /**
   * 同じ行列の全行のラベル（「行をコピー」のコピー元の選択肢）。
   * 未指定の場合は「行をコピー」を表示しない。
   */
  copySourceLabels?: readonly string[];
  /** コピー元の行（行インデックス）が選ばれたときのハンドラ。 */
  onCopyFrom?: (sourceRowIndex: number) => void;
}

/**
 * 選好入力の1行分（1人・1部署の希望順位）をプルダウン方式で編集する行コンポーネント。
 *
 * 「第1希望」「第2希望」…のプルダウンを希望順に並べ、入力済みの選択肢は他の希望順位の
 * 選択肢から除外することで重複を構造的に防止する。末尾には次の希望順位を追加する
 * ための空プルダウンを1つだけ表示し、選択済みの希望順位数 + 1 件を超えて表示しない
 * （相手の人数が多い場合でも一度に表示するプルダウンの数を抑える）。
 *
 * 行の正本は引き続き行列（RankCell の配列）。表示用の希望順（列インデックスの配列）は
 * entities/matching の filledColumnsInRankOrder / rowFromOrderedColumns で相互変換する。
 * この変換を経由する限り、希望順位は常に1から連続した値になるため、順位の重複・抜けは
 * 構造的に発生しない（validateRow が検出しうるのは「1件も選択していない」場合のみ）。
 *
 * 入力補助として、行見出しの横に「残りを自動補完」（未選択の相手を列の順に末尾へ追加）と
 * 「行をコピー」（同じ行列の別の行の内容を複製）を置く。プルダウン間は矢印キーで移動できる
 * （左右 = 同じ行の前後の希望順位、上下 = 前後の行）。
 */
export function PreferencePulldownRow({
  rowLabel,
  counterpartLabels,
  row,
  validation,
  onChangeRow,
  rowIdPrefix,
  rowIndex,
  copySourceLabels,
  onCopyFrom,
}: PreferencePulldownRowProps) {
  const columnCount = counterpartLabels.length;
  const orderedColumns = filledColumnsInRankOrder(row);
  const selectedColumns = new Set(orderedColumns);

  function commit(nextOrderedColumns: readonly number[]) {
    onChangeRow(rowFromOrderedColumns(nextOrderedColumns, columnCount));
  }

  function handleChangeSlot(position: number, rawValue: string) {
    if (rawValue === "") {
      return;
    }
    const next = [...orderedColumns];
    next[position] = Number(rawValue);
    commit(next);
  }

  function handleRemoveSlot(position: number) {
    commit(orderedColumns.filter((_, i) => i !== position));
  }

  function handleAddSlot(rawValue: string) {
    if (rawValue === "") {
      return;
    }
    commit([...orderedColumns, Number(rawValue)]);
  }

  function handleCopyFrom(rawValue: string) {
    if (rawValue === "" || onCopyFrom === undefined) {
      return;
    }
    onCopyFrom(Number(rawValue));
  }

  function handleFillRemaining() {
    onChangeRow(fillRemaining(row));
    // 補完で行が埋まるとボタン自体が無効化されるため、フォーカスを行の先頭へ移す。
    requestAnimationFrame(() => focusFirstCellInRow(rowIdPrefix, rowIndex));
  }

  const isComplete = isRowComplete(row);
  const copySelectId = `${rowIdPrefix}-row-${rowIndex}-copy`;

  if (columnCount === 0) {
    return (
      <div
        id={`${rowIdPrefix}-row-${rowIndex}`}
        className="rounded-control border border-slate-200 bg-white px-4 py-3"
      >
        <p className="text-sm font-medium text-slate-900">{rowLabel}</p>
        <p className="mt-1 text-xs text-slate-500">選択肢がありません。</p>
      </div>
    );
  }

  const rowErrorId = `${rowIdPrefix}-row-${rowIndex}-error`;

  return (
    <div
      id={`${rowIdPrefix}-row-${rowIndex}`}
      className="rounded-control border border-slate-200 bg-white px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">{rowLabel}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size={null}
            className="h-11 px-3 text-sm"
            disabled={isComplete}
            onClick={handleFillRemaining}
            aria-label={`${rowLabel}の残りを自動補完`}
          >
            残りを自動補完
          </Button>
          {copySourceLabels !== undefined && copySourceLabels.length > 1 ? (
            <>
              <label htmlFor={copySelectId} className="sr-only">
                {`${rowLabel}へコピーする行`}
              </label>
              <select
                id={copySelectId}
                value=""
                onKeyDown={suppressArrowKeySelection}
                onChange={(event) => handleCopyFrom(event.target.value)}
                className="h-11 max-w-[11rem] rounded-control border border-slate-300 bg-white px-2 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <option value="" disabled>
                  行をコピー…
                </option>
                {copySourceLabels.map((label, idx) =>
                  idx === rowIndex ? null : (
                    <option key={idx} value={idx}>
                      {idx === rowIndex - 1 ? `${label}（直前の行）` : label}
                    </option>
                  ),
                )}
              </select>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {orderedColumns.map((columnIndex, position) => {
          const selectId = `${rowIdPrefix}-row-${rowIndex}-rank-${position}`;
          return (
            <div key={position} className="flex items-center gap-1.5">
              <label htmlFor={selectId} className="text-xs font-medium text-slate-500">
                {`第${position + 1}希望`}
              </label>
              <select
                id={selectId}
                {...gridCellAttributes(rowIdPrefix, rowIndex, position)}
                onKeyDown={handleGridKeyDown}
                value={columnIndex}
                aria-describedby={validation.isValid === false ? rowErrorId : undefined}
                onChange={(event) => handleChangeSlot(position, event.target.value)}
                className="h-11 min-w-0 rounded-control border border-primary-300 bg-primary-50 px-2 text-sm font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                {counterpartLabels.map((label, idx) =>
                  idx === columnIndex || !selectedColumns.has(idx) ? (
                    <option key={idx} value={idx}>
                      {label}
                    </option>
                  ) : null,
                )}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveSlot(position)}
                aria-label={`${rowLabel}の第${position + 1}希望を削除`}
              >
                削除
              </Button>
            </div>
          );
        })}

        {orderedColumns.length < columnCount ? (
          <div className="flex items-center gap-1.5">
            <label
              htmlFor={`${rowIdPrefix}-row-${rowIndex}-rank-${orderedColumns.length}`}
              className="text-xs font-medium text-slate-500"
            >
              {`第${orderedColumns.length + 1}希望`}
            </label>
            <select
              id={`${rowIdPrefix}-row-${rowIndex}-rank-${orderedColumns.length}`}
              {...gridCellAttributes(rowIdPrefix, rowIndex, orderedColumns.length)}
              onKeyDown={handleGridKeyDown}
              value=""
              aria-describedby={validation.isValid === false ? rowErrorId : undefined}
              onChange={(event) => handleAddSlot(event.target.value)}
              className={cn(
                "h-11 min-w-0 rounded-control border px-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                orderedColumns.length === 0 && validation.isValid === false
                  ? "border-danger-500 bg-danger-50"
                  : "border-slate-300",
              )}
            >
              <option value="" disabled>
                選択してください
              </option>
              {counterpartLabels.map((label, idx) =>
                !selectedColumns.has(idx) ? (
                  <option key={idx} value={idx}>
                    {label}
                  </option>
                ) : null,
              )}
            </select>
          </div>
        ) : null}
      </div>

      {validation.isValid === false ? (
        <p id={rowErrorId} className="mt-1.5 text-xs text-danger-600">
          {validation.continuityError ?? "順位を確認してください。"}
        </p>
      ) : null}
    </div>
  );
}
