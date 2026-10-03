import { useRef, useState } from "react";
import { useParams } from "react-router-dom";

import type { FollowUpThreshold } from "../../../entities/matching";
import { DEFAULT_FOLLOW_UP_THRESHOLD, FOLLOW_UP_THRESHOLDS } from "../../../entities/matching";
import { describeDeletion } from "../../../entities/result-share";
import { useSharedResult } from "../../../features/result-share";
import { REMAINING_REFRESH_MS, useNow } from "../../../shared/lib";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle } from "../../../shared/ui";
import { AssignmentMap, DetailTable } from "../../../widgets/assignment-map";
import { EmployeeExplanation } from "../../../widgets/employee-explanation";
import type { DistributionTarget } from "../../../widgets/result-summary";
import { FollowUpList, ResultSummary } from "../../../widgets/result-summary";
import { StepPlayer } from "../../../widgets/step-player";

function StatusMessage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description !== undefined && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      </Card>
    </div>
  );
}

/**
 * 共有されたマッチング結果の閲覧専用画面（`/matching/shared/:token`）。
 *
 * 閲覧用トークンで保存された入力を取得し、マッチング実行 API で結果を再計算して、
 * サマリー・性質レポート・配属マップ・詳細テーブル・説明パネル・ステップ再生を表示する。
 * 閲覧者はログイン不要で、入力の編集・再実行・エクスポートの導線は出さない。
 * 閲覧者自身のブラウザに保存された入力・実行結果には触れない。
 * 免責文と自動削除までの日数・削除日は常時表示する。
 */
export function ResultViewPage() {
  const { token } = useParams<{ token: string }>();
  const { shared, input, result } = useSharedResult(token ?? "");
  const now = useNow(REMAINING_REFRESH_MS);
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [replayEmployeeIndex, setReplayEmployeeIndex] = useState<number | null>(null);
  const [selectedEmployeeIndex, setSelectedEmployeeIndex] = useState<number | null>(null);
  const explanationRef = useRef<HTMLDivElement>(null);
  const [followUpThreshold, setFollowUpThreshold] = useState<FollowUpThreshold>(
    DEFAULT_FOLLOW_UP_THRESHOLD,
  );
  const followUpRef = useRef<HTMLDivElement>(null);

  if (shared.isError) {
    return (
      <StatusMessage
        title="この共有 URL は表示できません"
        description={shared.error.message}
      />
    );
  }
  if (result.isError) {
    return (
      <StatusMessage
        title="結果を表示できませんでした"
        description={`共有された入力から結果を再計算できませんでした（${result.error.message}）。`}
      />
    );
  }
  if (shared.data === undefined || input === undefined || result.data === undefined) {
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

  const matchingResult = result.data;
  const deletion = describeDeletion(new Date(shared.data.expires_at), now);

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

  const notice = (
    <div className="flex flex-col gap-1 rounded-control border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
      <p className="font-medium text-slate-700">この共有データは{deletion}。</p>
      <p>
        本結果は入力データに対してアルゴリズムが理論的に保証する性質を示す参考情報です。配属・評価等の決定を保証・代行するものではなく、入力データ自体の正確性・網羅性は検証していません。
      </p>
    </div>
  );

  if (isReplayOpen) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        {notice}
        <StepPlayer
          result={matchingResult}
          initialTrackedEmployeeIndex={replayEmployeeIndex}
          onClose={() => setIsReplayOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">共有されたマッチング結果</h1>
            <Badge variant="primary">閲覧専用</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            共有された入力から結果を再計算して表示しています。入力の編集・再実行はできません。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => openReplay(null)}>
            実行過程を見る
          </Button>
        </div>
      </div>

      {notice}

      <ResultSummary
        result={matchingResult}
        proposerPrefs={input.proposer_prefs}
        onSelectDistribution={handleSelectDistribution}
      />
      <div ref={followUpRef} className="scroll-mt-6">
        <FollowUpList
          result={matchingResult}
          prefs={input}
          threshold={followUpThreshold}
          onThresholdChange={setFollowUpThreshold}
          onSelectEmployee={handleSelectFromFollowUp}
        />
      </div>
      <AssignmentMap
        result={matchingResult}
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
            result={matchingResult}
            proposerPrefs={input.proposer_prefs}
            selectedEmployeeIndex={selectedEmployeeIndex}
            onSelectEmployee={handleSelectEmployee}
            followUpThreshold={followUpThreshold}
          />
          <div ref={explanationRef} className="scroll-mt-6 lg:sticky lg:top-6 lg:self-start">
            <EmployeeExplanation
              result={matchingResult}
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
