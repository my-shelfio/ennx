import { useRef, useState } from "react";
import { Navigate } from "react-router-dom";

import type { FollowUpThreshold } from "../../../entities/matching";
import {
  DEFAULT_FOLLOW_UP_THRESHOLD,
  FOLLOW_UP_THRESHOLDS,
  useMatchingInputStore,
  useMatchingResultStore,
} from "../../../entities/matching";
import { ExportMenu } from "../../../features/export-result";
import { useRunMatching } from "../../../features/run-matching";
import { ShareLinkButton } from "../../../features/share-link";
import { ROUTES } from "../../../shared/config";
import { Button, useToast } from "../../../shared/ui";
import { AssignmentMap, DetailTable } from "../../../widgets/assignment-map";
import { EmployeeExplanation } from "../../../widgets/employee-explanation";
import type { DistributionTarget } from "../../../widgets/result-summary";
import { FollowUpList, ResultSummary } from "../../../widgets/result-summary";
import { StepPlayer } from "../../../widgets/step-player";

/**
 * 結果画面。
 * サマリーカード・性質レポート・配属マップ・詳細テーブルを表示する。
 * 実行結果（`useMatchingResultStore`）は localStorage に永続化されないため、
 * ページ再読み込み等で失われている場合は選好入力画面へ戻す。
 * 「実行過程を見る」ボタンでステップ再生ビューア（widgets/step-player）を表示する。
 * 「共有リンクをコピー」ボタンは features/share-link の ShareLinkButton に委譲する。
 * 「エクスポート」ボタンは features/export-result の ExportMenu に委譲する。
 *
 * 詳細テーブルで社員を選ぶと、その社員の「なぜこの配属か」説明パネル
 * （widgets/employee-explanation）を表示し、そこから当該社員を追跡した状態で
 * ステップ再生を開ける。
 *
 * 希望順位・説明文の算出には、結果と一緒に保持した「実行時の入力」を使う
 * （入力ストアは実行後も編集できるため）。保持がない場合のみ入力ストアで代替する。
 */
export function ResultPage() {
  const result = useMatchingResultStore((state) => state.result);
  const setResult = useMatchingResultStore((state) => state.setResult);
  const runInput = useMatchingResultStore((state) => state.input);
  const currentInput = useMatchingInputStore((state) => state.input);
  const input = runInput ?? currentInput;
  const { toast } = useToast();
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [replayEmployeeIndex, setReplayEmployeeIndex] = useState<number | null>(null);
  const [selectedEmployeeIndex, setSelectedEmployeeIndex] = useState<number | null>(null);
  const explanationRef = useRef<HTMLDivElement>(null);
  const [followUpThreshold, setFollowUpThreshold] = useState<FollowUpThreshold>(
    DEFAULT_FOLLOW_UP_THRESHOLD,
  );
  const followUpRef = useRef<HTMLDivElement>(null);
  const runMutation = useRunMatching();

  if (result === null) {
    return <Navigate to={ROUTES.matching.preferences} replace />;
  }

  function handleReRun() {
    runMutation.mutate(input, {
      onSuccess: (nextResult) => {
        setResult(nextResult, input);
      },
      onError: (error) => {
        toast({
          title: "再実行に失敗しました",
          description: error.message,
          variant: "danger",
        });
      },
    });
  }

  function handleSelectEmployee(employeeIndex: number) {
    setSelectedEmployeeIndex(employeeIndex);
    // 1 カラム表示（lg 未満）では説明パネルがテーブルの下にあるため、選択後にパネルへ移動する。
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      explanationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleSelectFromFollowUp(employeeIndex: number) {
    // フォロー推奨一覧は詳細テーブルより上にあるため、画面幅によらず説明パネルへ移動する。
    setSelectedEmployeeIndex(employeeIndex);
    explanationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSelectDistribution(target: DistributionTarget) {
    if (target.kind === "rank") {
      // 選んだ段が含まれるしきい値（選択肢の範囲内で最も近いもの）に切り替える。
      const threshold =
        [...FOLLOW_UP_THRESHOLDS].reverse().find((value) => value <= target.rank) ??
        FOLLOW_UP_THRESHOLDS[0];
      setFollowUpThreshold(threshold);
    }
    followUpRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openReplay(employeeIndex: number | null) {
    setReplayEmployeeIndex(employeeIndex);
    setIsReplayOpen(true);
  }

  if (isReplayOpen) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <StepPlayer
          result={result}
          initialTrackedEmployeeIndex={replayEmployeeIndex}
          onClose={() => setIsReplayOpen(false)}
          onReRun={handleReRun}
          isReRunning={runMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">マッチング結果</h1>
          <p className="mt-1 text-sm text-slate-500">
            サマリー・配属マップ・詳細テーブルで結果を確認できます。
          </p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => openReplay(null)}>
            実行過程を見る
          </Button>
          <ShareLinkButton input={input} />
          <ExportMenu input={input} result={result} />
        </div>
      </div>

      <p className="rounded-control border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        本結果は入力データに対してアルゴリズムが理論的に保証する性質を示す参考情報です。配属・評価等の決定を保証・代行するものではなく、入力データ自体の正確性・網羅性は検証していません。
      </p>

      <ResultSummary
        result={result}
        proposerPrefs={input.proposer_prefs}
        onSelectDistribution={handleSelectDistribution}
      />
      <div ref={followUpRef} className="scroll-mt-6">
        <FollowUpList
          result={result}
          prefs={input}
          threshold={followUpThreshold}
          onThresholdChange={setFollowUpThreshold}
          onSelectEmployee={handleSelectFromFollowUp}
        />
      </div>
      <AssignmentMap
        result={result}
        proposerPrefs={input.proposer_prefs}
        receiverPrefs={input.receiver_prefs}
      />

      <div>
        <h2 className="text-lg font-semibold text-slate-900">詳細</h2>
        <p className="mt-1 text-sm text-slate-500">
          社員名を選ぶと、その社員の配属の経緯（受け入れられなかった理由を含む）を表示します。
        </p>
        <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <DetailTable
            result={result}
            proposerPrefs={input.proposer_prefs}
            selectedEmployeeIndex={selectedEmployeeIndex}
            onSelectEmployee={handleSelectEmployee}
            followUpThreshold={followUpThreshold}
          />
          <div ref={explanationRef} className="scroll-mt-6 lg:sticky lg:top-6 lg:self-start">
            <EmployeeExplanation
              result={result}
              prefs={input}
              employeeIndex={selectedEmployeeIndex}
              onReplay={openReplay}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
