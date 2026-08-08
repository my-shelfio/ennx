import { Button } from "../../../shared/ui";
import { EVENT_TYPE_FILTER_OPTIONS, type EventTypeFilter } from "../lib/stepFilters";

export interface PlaybackControlsProps {
  /** 0-indexed の現在ステップ。 */
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  /** 自動再生の間隔（ミリ秒、小さいほど速い）。 */
  speedMs: number;
  onStepChange: (step: number) => void;
  onTogglePlay: () => void;
  onSpeedChange: (speedMs: number) => void;

  /** 社員名一覧（追跡対象選択の選択肢）。 */
  employeeNames: readonly string[];
  /** イベント種別フィルタ（スキップ移動の絞り込み条件の一部）。 */
  eventFilter: EventTypeFilter;
  onEventFilterChange: (filter: EventTypeFilter) => void;
  /** 追跡対象社員（0-indexed）。null は追跡なし。 */
  trackedEmployeeIndex: number | null;
  onTrackedEmployeeChange: (employeeIndex: number | null) => void;

  /** イベント種別フィルタ・社員追跡の条件を満たす直前/直後のステップへスキップ移動できるか。 */
  canSkipToPrevious: boolean;
  canSkipToNext: boolean;
  onSkipToPrevious: () => void;
  onSkipToNext: () => void;

  /** 追跡中の社員の配属が確定したステップへジャンプできるか。 */
  canJumpToConfirmed: boolean;
  onJumpToConfirmed: () => void;
  /** 最終結果（最終ステップ）へジャンプする。 */
  onJumpToFinal: () => void;
}

const SPEED_OPTIONS: { label: string; speedMs: number }[] = [
  { label: "0.5倍速", speedMs: 1600 },
  { label: "1倍速", speedMs: 800 },
  { label: "2倍速", speedMs: 400 },
];

/**
 * 再生コントロール。
 * 前へ/次へ・スライダー・自動再生（速度切替）・一時停止に加え、イベント種別フィルタと
 * 社員追跡によるスキップ移動、および「配属確定ステップへ」「最終結果へ」のジャンプボタンを
 * 提供する。すべてネイティブの button / input[type=range] / select を使い、キーボード操作
 * （Tab移動 + Enter/Space での実行）を標準で担保する。
 *
 * スキップ移動・ジャンプは移動先のステップ番号を絞るだけで、`totalSteps` や現在ステップの
 * 連続性には影響しない（前へ/次へ・スライダーは引き続き全ステップを行き来できる）。
 */
export function PlaybackControls({
  currentStep,
  totalSteps,
  isPlaying,
  speedMs,
  onStepChange,
  onTogglePlay,
  onSpeedChange,
  employeeNames,
  eventFilter,
  onEventFilterChange,
  trackedEmployeeIndex,
  onTrackedEmployeeChange,
  canSkipToPrevious,
  canSkipToNext,
  onSkipToPrevious,
  onSkipToNext,
  canJumpToConfirmed,
  onJumpToConfirmed,
  onJumpToFinal,
}: PlaybackControlsProps) {
  const isFirst = currentStep <= 0;
  const isLast = currentStep >= totalSteps - 1;

  return (
    <div className="flex flex-col gap-3">
      <input
        type="range"
        aria-label="ステップ位置"
        min={0}
        max={Math.max(totalSteps - 1, 0)}
        value={currentStep}
        onChange={(event) => onStepChange(Number(event.target.value))}
        className="w-full accent-primary-500"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onStepChange(Math.max(currentStep - 1, 0))}
          disabled={isFirst}
        >
          前へ
        </Button>
        <Button type="button" size="sm" onClick={onTogglePlay} disabled={isLast && !isPlaying}>
          {isPlaying ? "一時停止" : "自動再生"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onStepChange(Math.min(currentStep + 1, totalSteps - 1))}
          disabled={isLast}
        >
          次へ
        </Button>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          速度
          <select
            value={speedMs}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
            className="h-9 rounded-control border border-slate-300 px-2 text-sm"
          >
            {SPEED_OPTIONS.map((option) => (
              <option key={option.speedMs} value={option.speedMs}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          イベント種別フィルタ
          <select
            aria-label="イベント種別フィルタ"
            value={eventFilter}
            onChange={(event) => onEventFilterChange(event.target.value as EventTypeFilter)}
            className="h-9 rounded-control border border-slate-300 px-2 text-sm"
          >
            {EVENT_TYPE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-600">
          社員を追跡
          <select
            aria-label="追跡する社員"
            value={trackedEmployeeIndex ?? ""}
            onChange={(event) => {
              const { value } = event.target;
              onTrackedEmployeeChange(value === "" ? null : Number(value));
            }}
            className="h-9 min-w-32 rounded-control border border-slate-300 px-2 text-sm"
          >
            <option value="">追跡しない</option>
            {employeeNames.map((name, index) => (
              <option key={index} value={index}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSkipToPrevious}
            disabled={!canSkipToPrevious}
          >
            前の対象へ
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSkipToNext}
            disabled={!canSkipToNext}
          >
            次の対象へ
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onJumpToConfirmed}
            disabled={!canJumpToConfirmed}
          >
            配属確定ステップへ
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onJumpToFinal} disabled={isLast}>
            最終結果へ
          </Button>
        </div>
      </div>
    </div>
  );
}
