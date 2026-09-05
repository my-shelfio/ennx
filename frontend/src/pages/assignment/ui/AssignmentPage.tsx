import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAssignmentInputStore, useAssignmentResultStore } from "../../../entities/assignment";
import { ExportAssignmentMenu } from "../../../features/export-assignment-result";
import { useAssignmentSample, useRunAssignment } from "../../../features/run-assignment";
import { useToast } from "../../../shared/ui";
import { AssignmentForm } from "../../../widgets/assignment-form";
import { AssignmentResultPanel } from "../../../widgets/assignment-result";
import { AssignmentStepPlayer } from "../../../widgets/assignment-step-player";

/**
 * 割り当て（PS メカニズム）の実行画面。
 *
 * 「条件を入れる → 希望を入れる → 実行する → 結果と過程を見る」という
 * ennx 共通の流れを 1 ページに収めている。配属マッチングと違い部署側の順位づけが
 * 不要なため、ウィザードに分けずに済む。モジュールの説明は導入ページ側にあり、
 * この画面は実行に専念する。
 *
 * "?sample=1"（導入ページの「サンプルデータで試す」からの遷移）の場合、マウント時に
 * サンプル入力を取得してストアへ投入し、入力済みの状態で表示する。取得失敗時は
 * エラートーストを表示したうえで空のフォームを表示し、手入力を継続できるようにする。
 */
export function AssignmentPage() {
  const [searchParams] = useSearchParams();
  const isSample = searchParams.get("sample") === "1";
  const { input, setInput, replaceInput } = useAssignmentInputStore();
  const { result, setResult, clear } = useAssignmentResultStore();
  const run = useRunAssignment();
  const sample = useAssignmentSample();
  const { mutate: loadSample } = sample;
  const { toast } = useToast();

  // クエリ指定によるサンプル読み込みは初回マウント時の 1 回だけ行う
  // （画面内の「サンプルを読み込む」操作と干渉させない）。
  const initialSampleRequestedRef = useRef(false);
  const [loadingInitialSample, setLoadingInitialSample] = useState(isSample);

  useEffect(() => {
    document.title = "割り当て（PS メカニズム） | ennx";
  }, []);

  useEffect(() => {
    if (!isSample || initialSampleRequestedRef.current) {
      return;
    }
    initialSampleRequestedRef.current = true;
    loadSample(undefined, {
      onSuccess: (loaded) => {
        replaceInput(loaded);
        clear();
        setLoadingInitialSample(false);
      },
      onError: (error) => {
        setLoadingInitialSample(false);
        toast({
          variant: "danger",
          title: "サンプルデータの取得に失敗しました",
          description: `${error.message}。手入力で設定を続けられます。`,
        });
      },
    });
  }, [isSample, loadSample, replaceInput, clear, toast]);

  const handleSubmit = (seed?: number) => {
    clear();
    // シードは実行時のパラメータとして扱い、入力ストアには保存しない
    // （未指定ならサーバーが毎回生成する既定の挙動を保つ）。
    run.mutate(seed === undefined ? input : { ...input, seed }, {
      onSuccess: setResult,
      onError: (error) =>
        toast({
          variant: "danger",
          title: "実行できませんでした",
          description: error.message,
        }),
    });
  };

  const handleLoadSample = () => {
    loadSample(undefined, {
      onSuccess: (loaded) => {
        replaceInput(loaded);
        clear();
      },
      onError: (error) =>
        toast({
          variant: "danger",
          title: "サンプルを読み込めませんでした",
          description: error.message,
        }),
    });
  };

  if (loadingInitialSample) {
    return (
      <div
        role="status"
        className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-20 text-sm text-slate-500 sm:px-6"
      >
        <span
          aria-hidden="true"
          className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600"
        />
        サンプルデータを読み込んでいます…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">割り当て（希望だけで配分する）</h1>
        <p className="text-sm text-slate-600">
          部署の側で候補者に順位をつけられない配分（席替え・持ち回り・案件アサインなど）を、
          社員の希望順位だけで公平に決めます。結果は「配属される確率」と、それを実際に配るための
          くじの形で示します。
        </p>
      </header>

      <AssignmentForm
        input={input}
        onChange={(next) => setInput(next)}
        onSubmit={() => handleSubmit()}
        onLoadSample={handleLoadSample}
        submitting={run.isPending || sample.isPending}
      />

      {result && (
        <>
          <div className="flex justify-end">
            <ExportAssignmentMenu input={input} result={result} />
          </div>
          <AssignmentResultPanel
            result={result}
            onRedraw={() => handleSubmit()}
            onReproduce={(seed) => handleSubmit(seed)}
          />
          <AssignmentStepPlayer result={result} />
        </>
      )}
    </div>
  );
}
