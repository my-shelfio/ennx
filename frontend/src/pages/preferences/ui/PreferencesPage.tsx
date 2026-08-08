import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useMatchingInputStore, useMatchingResultStore } from "../../../entities/matching";
import { ImportPanel } from "../../../features/import-input";
import { useRunMatching } from "../../../features/run-matching";
import { ApiError } from "../../../shared/api";
import { ROUTES } from "../../../shared/config";
import { Button, useToast } from "../../../shared/ui";
import { PreferenceMatrix } from "../../../widgets/preference-matrix";

/**
 * 選好入力ページ。
 * 設定ウィザード（/setup）を完了していない場合（定員・選好の枠が未確保）は /setup へ戻す。
 * 「マッチングを実行」押下で `POST /api/v1/matching/run` を呼び出し、成功時は結果を
 * `useMatchingResultStore` に保持して /result へ遷移する。失敗時はエラートーストを表示し
 * 入力は保持したまま選好入力画面に留まる（再試行はボタン再押下）。
 *
 * 選好行列のみの CSV 再取込（#123）にも対応する。既存の部署・社員名簿は変更せず、
 * employee_prefs.csv・department_prefs.csv の2ファイルのみを受け付ける
 * （エクスポート→外部で編集→再インポートの往復運用向け）。
 */
export function PreferencesPage() {
  const input = useMatchingInputStore((state) => state.input);
  const setResult = useMatchingResultStore((state) => state.setResult);
  const { toast } = useToast();
  const navigate = useNavigate();
  const runMutation = useRunMatching();

  const [isImportOpen, setIsImportOpen] = useState(false);

  const isReady = input.capacities.length > 0 && input.proposer_prefs.length > 0;
  if (!isReady) {
    return <Navigate to={ROUTES.matching.setup} replace />;
  }

  function handleSubmit() {
    runMutation.mutate(input, {
      onSuccess: (result) => {
        setResult(result);
        navigate(ROUTES.matching.result);
      },
      onError: (error) => {
        if (error instanceof ApiError) {
          toast({
            title: "実行できませんでした",
            description: error.fieldErrors.map((fieldError) => fieldError.message).join(" "),
            variant: "danger",
          });
          return;
        }
        toast({
          title: "接続に失敗しました",
          description: `${error.message}。入力内容は保持されています。再試行してください。`,
          variant: "danger",
        });
      },
    });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">希望順位を入力してください</h1>
        <p className="mt-1 text-sm text-slate-500">
          社員 → 部署・部署 → 社員の両方の希望順位を、この画面でまとめて入力します。入力内容は自動的に保存されます。
        </p>
      </div>

      <PreferenceMatrix onSubmit={handleSubmit} isSubmitting={runMutation.isPending} />

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link to={ROUTES.matching.setup}>設定に戻る</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIsImportOpen((open) => !open);
          }}
        >
          {isImportOpen ? "CSV再取込を閉じる" : "CSVから再取込"}
        </Button>
      </div>

      {isImportOpen ? (
        <ImportPanel
          mode="preferences"
          onImported={() => {
            setIsImportOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
