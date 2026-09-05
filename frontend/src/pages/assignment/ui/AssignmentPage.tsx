import { useEffect } from "react";

import { useAssignmentInputStore, useAssignmentResultStore } from "../../../entities/assignment";
import { ExportAssignmentMenu } from "../../../features/export-assignment-result";
import { useAssignmentSample, useRunAssignment } from "../../../features/run-assignment";
import { useToast } from "../../../shared/ui";
import { AssignmentForm } from "../../../widgets/assignment-form";
import { AssignmentResultPanel } from "../../../widgets/assignment-result";
import { AssignmentStepPlayer } from "../../../widgets/assignment-step-player";

/**
 * 割り当て（PS メカニズム）の 1 画面ページ。
 *
 * 「条件を入れる → 希望を入れる → 実行する → 結果と過程を見る」という
 * ennx 共通の流れを 1 ページに収めている。配属マッチングと違い部署側の順位づけが
 * 不要なため、ウィザードに分けずに済む。
 */
export function AssignmentPage() {
  const { input, setInput, replaceInput } = useAssignmentInputStore();
  const { result, setResult, clear } = useAssignmentResultStore();
  const run = useRunAssignment();
  const sample = useAssignmentSample();
  const { toast } = useToast();

  useEffect(() => {
    document.title = "割り当て（PS メカニズム） | ennx";
  }, []);

  const handleSubmit = () => {
    clear();
    run.mutate(input, {
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
    sample.mutate(undefined, {
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
        onSubmit={handleSubmit}
        onLoadSample={handleLoadSample}
        submitting={run.isPending || sample.isPending}
      />

      {result && (
        <>
          <div className="flex justify-end">
            <ExportAssignmentMenu input={input} result={result} />
          </div>
          <AssignmentResultPanel result={result} />
          <AssignmentStepPlayer result={result} />
        </>
      )}
    </div>
  );
}
