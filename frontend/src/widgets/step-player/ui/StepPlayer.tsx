import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import type { MatchingResult } from "../../../entities/matching";
import { parseMatchingEvents } from "../../../entities/matching";
import { useReducedMotion } from "../../../shared/lib";
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle } from "../../../shared/ui";
import { describeEvent } from "../lib/eventDescription";
import { highlightedEdgeForEvent } from "../lib/highlightedEdge";
import {
  buildFilteredStepIndices,
  findEmployeeConfirmedStepIndex,
  nextFilteredStep,
  previousFilteredStep,
  type EventTypeFilter,
} from "../lib/stepFilters";

import { BipartiteGraph } from "./BipartiteGraph";
import { PlaybackControls } from "./PlaybackControls";

export interface StepPlayerProps {
  result: MatchingResult;
  /** 「結果画面に戻る」押下時のハンドラ。 */
  onClose: () => void;
  /** イベントログ未保持時（`result.events` が空）の再実行ハンドラ（例外フロー1a）。 */
  onReRun?: () => void;
  isReRunning?: boolean;
}

const DEFAULT_SPEED_MS = 800;

/** キーボード操作を素通りさせる（干渉しない）ネイティブコントロールのタグ名。 */
const NATIVE_CONTROL_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A"]);

const KEYBOARD_HELP_TEXT =
  "キーボード操作: ← / → でステップ移動、Space で再生・一時停止、Home / End で先頭 / 最終へ移動" +
  "（このビューア自体にフォーカスがある場合のみ有効。ボタンやスライダーにフォーカス中は" +
  "それぞれのネイティブ操作が優先されます）。";

/**
 * ステップ再生ビューア。実行過程をステップ再生で確認できるようにする。
 * 二部グラフ図・再生コントロール・テキスト説明を組み合わせる。イベントログが
 * 空の場合（ページ再読み込み後の再訪問等、通常は起こらないが防御的に扱う）は
 * 例外フロー1aの再実行導線を表示する。
 *
 * キーボード操作（←/→/Space/Home/End）・イベント種別フィルタ・社員追跡・
 * 「配属確定ステップへ」「最終結果へ」のジャンプに対応する（#126）。
 */
export function StepPlayer({ result, onClose, onReRun, isReRunning = false }: StepPlayerProps) {
  const snapshots = useMemo(
    () =>
      parseMatchingEvents(
        result.events,
        result.employee_names.length,
        result.department_names.length,
      ),
    [result.events, result.employee_names.length, result.department_names.length],
  );

  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(DEFAULT_SPEED_MS);
  const [eventFilter, setEventFilter] = useState<EventTypeFilter>("all");
  const [trackedEmployeeIndex, setTrackedEmployeeIndex] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const isLastStep = currentStep >= snapshots.length - 1;
  // 最終ステップに到達したら自動再生は実質的に停止したものとして描画する
  // （`isPlaying` state 自体は次にユーザーが操作するまで保持し、effect 内での
  // setState を避ける。react-hooks/set-state-in-effect 対応）。
  const isEffectivelyPlaying = isPlaying && !isLastStep;

  useEffect(() => {
    if (!isEffectivelyPlaying) {
      return;
    }
    const timer = setTimeout(() => {
      setCurrentStep((step) => Math.min(step + 1, snapshots.length - 1));
    }, speedMs);
    return () => clearTimeout(timer);
    // currentStep の変化のたびに次のタイマーを再スケジュールする必要があるため、
    // 依存配列に含める（このタイマーは setTimeout のコールバック内でのみ setState する）。
  }, [isEffectivelyPlaying, snapshots.length, speedMs, currentStep]);

  // イベント種別フィルタ・社員追跡の条件を満たすステップのインデックス一覧。
  // snapshots・eventFilter・trackedEmployeeIndex が変化したときのみ再計算し、
  // ステップ移動のたびに全走査しないようにする（大規模イベントログでの性能対応）。
  const filteredStepIndices = useMemo(
    () => buildFilteredStepIndices(snapshots, eventFilter, trackedEmployeeIndex),
    [snapshots, eventFilter, trackedEmployeeIndex],
  );

  // 追跡中の社員の配属確定ステップ。追跡対象が変わったときのみ再計算する。
  const confirmedStepIndex = useMemo(
    () =>
      trackedEmployeeIndex === null
        ? null
        : findEmployeeConfirmedStepIndex(snapshots, trackedEmployeeIndex),
    [snapshots, trackedEmployeeIndex],
  );

  const previousStep = previousFilteredStep(filteredStepIndices, currentStep);
  const nextStep = nextFilteredStep(filteredStepIndices, currentStep);

  function handleStepChange(step: number) {
    setIsPlaying(false);
    setCurrentStep(step);
  }

  function handleTogglePlay() {
    setIsPlaying((playing) => !playing);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    // ネイティブコントロール（ボタン・スライダー・セレクト等）にフォーカスがある間は、
    // それぞれの標準キー操作を優先し、ビューア共通のショートカットは発火させない。
    if (NATIVE_CONTROL_TAGS.has(target.tagName)) {
      return;
    }

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        handleStepChange(Math.max(currentStep - 1, 0));
        break;
      case "ArrowRight":
        event.preventDefault();
        handleStepChange(Math.min(currentStep + 1, snapshots.length - 1));
        break;
      case " ":
      case "Spacebar":
        event.preventDefault();
        handleTogglePlay();
        break;
      case "Home":
        event.preventDefault();
        handleStepChange(0);
        break;
      case "End":
        event.preventDefault();
        handleStepChange(snapshots.length - 1);
        break;
      default:
        break;
    }
  }

  if (snapshots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>実行過程を表示するには再実行が必要です</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            保持しているイベントログが見つかりませんでした。localStorage
            の入力から再実行すると、実行過程を確認できます。
          </p>
        </CardContent>
        <CardFooter className="justify-between">
          <Button type="button" variant="outline" onClick={onClose}>
            結果画面に戻る
          </Button>
          {onReRun !== undefined ? (
            <Button type="button" onClick={onReRun} disabled={isReRunning}>
              再実行
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    );
  }

  const snapshot = snapshots[currentStep];
  if (snapshot === undefined) {
    return null;
  }
  const description = describeEvent(
    snapshot.event,
    result.employee_names,
    result.department_names,
    isLastStep,
  );
  const highlightedEdge = highlightedEdgeForEvent(snapshot.event, isLastStep);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>実行過程を再生</CardTitle>
              <span className="group relative inline-flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 rounded-pill p-0 text-xs"
                  aria-label="キーボード操作のヘルプ"
                >
                  ?
                </Button>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-max max-w-xs -translate-x-1/2 rounded-control bg-slate-900 px-3 py-2 text-xs text-white opacity-0 shadow-popover transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  {KEYBOARD_HELP_TEXT}
                </span>
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              ステップ {currentStep + 1} / {snapshots.length}（{description.title}）
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            結果画面に戻る
          </Button>
        </div>
      </CardHeader>
      <CardContent
        className="flex flex-col gap-4 outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
        tabIndex={0}
        role="group"
        aria-label={`ステップ再生ビューア。${KEYBOARD_HELP_TEXT}`}
        onKeyDown={handleKeyDown}
      >
        <BipartiteGraph
          proposerNames={result.employee_names}
          receiverNames={result.department_names}
          snapshot={snapshot}
          highlightedEdge={highlightedEdge}
          reduceMotion={prefersReducedMotion === true}
          trackedProposerIndex={trackedEmployeeIndex}
        />
        <p aria-live="polite" className="text-sm text-slate-700">
          {description.detail}
        </p>
        <PlaybackControls
          currentStep={currentStep}
          totalSteps={snapshots.length}
          isPlaying={isEffectivelyPlaying}
          speedMs={speedMs}
          onStepChange={handleStepChange}
          onTogglePlay={handleTogglePlay}
          onSpeedChange={setSpeedMs}
          employeeNames={result.employee_names}
          eventFilter={eventFilter}
          onEventFilterChange={setEventFilter}
          trackedEmployeeIndex={trackedEmployeeIndex}
          onTrackedEmployeeChange={setTrackedEmployeeIndex}
          canSkipToPrevious={previousStep !== null}
          canSkipToNext={nextStep !== null}
          onSkipToPrevious={() => {
            if (previousStep !== null) {
              handleStepChange(previousStep);
            }
          }}
          onSkipToNext={() => {
            if (nextStep !== null) {
              handleStepChange(nextStep);
            }
          }}
          canJumpToConfirmed={confirmedStepIndex !== null}
          onJumpToConfirmed={() => {
            if (confirmedStepIndex !== null) {
              handleStepChange(confirmedStepIndex);
            }
          }}
          onJumpToFinal={() => handleStepChange(snapshots.length - 1)}
        />
      </CardContent>
    </Card>
  );
}
