import { useState } from "react";
import { Navigate } from "react-router-dom";

import { useMatchingInputStore, useMatchingResultStore } from "../../../entities/matching";
import { ExportMenu } from "../../../features/export-result";
import { useRunMatching } from "../../../features/run-matching";
import { ShareLinkButton } from "../../../features/share-link";
import { ROUTES } from "../../../shared/config";
import { Button, useToast } from "../../../shared/ui";
import { AssignmentMap, DetailTable } from "../../../widgets/assignment-map";
import { ResultSummary } from "../../../widgets/result-summary";
import { StepPlayer } from "../../../widgets/step-player";

/**
 * 結果画面。
 * サマリーカード・性質レポート・配属マップ・詳細テーブルを表示する。
 * 実行結果（`useMatchingResultStore`）は localStorage に永続化されないため、
 * ページ再読み込み等で失われている場合は選好入力画面へ戻す。
 * 「実行過程を見る」ボタンでステップ再生ビューア（widgets/step-player）を表示する。
 * 「共有リンクをコピー」ボタンは features/share-link の ShareLinkButton に委譲する。
 * 「エクスポート」ボタンは features/export-result の ExportMenu に委譲する。
 */
export function ResultPage() {
  const result = useMatchingResultStore((state) => state.result);
  const setResult = useMatchingResultStore((state) => state.setResult);
  const input = useMatchingInputStore((state) => state.input);
  const { toast } = useToast();
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const runMutation = useRunMatching();

  if (result === null) {
    return <Navigate to={ROUTES.matching.preferences} replace />;
  }

  function handleReRun() {
    runMutation.mutate(input, {
      onSuccess: (nextResult) => {
        setResult(nextResult);
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

  if (isReplayOpen) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <StepPlayer
          result={result}
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
          <Button type="button" variant="outline" onClick={() => setIsReplayOpen(true)}>
            実行過程を見る
          </Button>
          <ShareLinkButton input={input} />
          <ExportMenu input={input} result={result} />
        </div>
      </div>

      <p className="rounded-control border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        本結果は入力データに対してアルゴリズムが理論的に保証する性質を示す参考情報です。配属・評価等の決定を保証・代行するものではなく、入力データ自体の正確性・網羅性は検証していません。
      </p>

      <ResultSummary result={result} proposerPrefs={input.proposer_prefs} />
      <AssignmentMap result={result} proposerPrefs={input.proposer_prefs} />

      <div>
        <h2 className="text-lg font-semibold text-slate-900">詳細</h2>
        <div className="mt-3">
          <DetailTable result={result} proposerPrefs={input.proposer_prefs} />
        </div>
      </div>
    </div>
  );
}
