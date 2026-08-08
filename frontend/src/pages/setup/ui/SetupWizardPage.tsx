import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { MatchingInput } from "../../../entities/matching";
import { useMatchingInputStore } from "../../../entities/matching";
import { useLoadSample } from "../../../features/load-sample";
import { ImportPanel } from "../../../features/import-input";
import { decodeShareLinkData } from "../../../features/share-link";
import { ROUTES } from "../../../shared/config";
import { useToast } from "../../../shared/ui";
import { SetupWizard } from "../../../widgets/setup-wizard";

import { ShareLinkPrompt } from "./ShareLinkPrompt";

type ShareLinkState =
  | { status: "none" }
  | { status: "checking" }
  | { status: "invalid" }
  | { status: "pending"; input: MatchingInput }
  | { status: "declined" };

/**
 * 設定ウィザードページ。サンプルデータで試す場合・共有リンク（`?d=`）経由の場合にも対応する。
 * ウィザード本体は widgets/setup-wizard（規模・制約種別・詳細の入力、ステップ間検証）で実装する。
 *
 * "?sample=1"（ホーム画面の「サンプルデータで試す」からの遷移）の場合、マウント時に
 * `GET /api/v1/sample` を取得してストアへ投入し、入力済み状態の選好入力画面（/preferences）へ
 * 遷移する。取得失敗時はエラートーストを表示し、通常のウィザード（空の状態）を表示して
 * 手入力を継続できるようにする（入力内容が失われない方針を踏襲する）。
 *
 * "?d=..."（結果画面の「共有リンクをコピー」から生成された共有リンク）の場合、
 * マウント時に URL パラメータを非同期で復号し（gzip 展開を伴うため）、確認ダイアログ
 * （ShareLinkPrompt）を経てからストアへ反映して選好入力画面へ遷移する（sample と同様の流れ）。
 * 復号に失敗した場合はクラッシュさせず、エラーメッセージを表示した上で通常のウィザードを
 * 続行できるようにする。
 *
 * ウィザードの手入力に加え、CSV一括インポートによる導入もサポートする。
 * settings.csv・employee_prefs.csv・department_prefs.csv の3ファイルを取り込むと
 * ウィザード完了相当の状態になるため、成功時はウィザードをスキップして選好入力画面
 * （/preferences。取込ファイルに応じて希望順位も入力済みのことがある）へ遷移する。
 */
export function SetupWizardPage() {
  const [searchParams] = useSearchParams();
  const isSample = searchParams.get("sample") === "1";
  const sharedData = searchParams.get("d");
  const navigate = useNavigate();
  const input = useMatchingInputStore((state) => state.input);
  const replaceInput = useMatchingInputStore((state) => state.replaceInput);
  const { toast } = useToast();
  const loadSampleMutation = useLoadSample();
  const { mutate: loadSample, status: loadSampleStatus } = loadSampleMutation;

  const [shareLinkState, setShareLinkState] = useState<ShareLinkState>(() =>
    sharedData === null ? { status: "none" } : { status: "checking" },
  );

  useEffect(() => {
    if (sharedData === null) {
      return;
    }
    let cancelled = false;
    decodeShareLinkData(sharedData)
      .then((decoded) => {
        if (cancelled) {
          return;
        }
        setShareLinkState(decoded === null ? { status: "invalid" } : { status: "pending", input: decoded });
      })
      .catch(() => {
        if (!cancelled) {
          setShareLinkState({ status: "invalid" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sharedData]);

  useEffect(() => {
    if (!isSample || loadSampleStatus !== "idle") {
      return;
    }
    loadSample(undefined, {
      onSuccess: (sampleInput) => {
        replaceInput(sampleInput);
        navigate(ROUTES.matching.preferences, { replace: true });
      },
      onError: (error) => {
        toast({
          title: "サンプルデータの取得に失敗しました",
          description: `${error.message}。手入力で設定を続けられます。`,
          variant: "danger",
        });
      },
    });
  }, [isSample, loadSampleStatus, loadSample, replaceInput, navigate, toast]);

  if (isSample && loadSampleStatus !== "error") {
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

  if (shareLinkState.status === "checking") {
    return (
      <div
        role="status"
        className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-20 text-sm text-slate-500 sm:px-6"
      >
        <span
          aria-hidden="true"
          className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600"
        />
        共有リンクを読み込んでいます…
      </div>
    );
  }

  if (shareLinkState.status === "pending") {
    const hasExistingInput = input.capacities.length > 0 || input.proposer_prefs.length > 0;
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <ShareLinkPrompt
          hasExistingInput={hasExistingInput}
          onLoad={() => {
            replaceInput(shareLinkState.input);
            navigate(ROUTES.matching.preferences, { replace: true });
          }}
          onCancel={() => setShareLinkState({ status: "declined" })}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      {shareLinkState.status === "invalid" && (
        <p
          role="alert"
          className="rounded-control border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700"
        >
          共有リンクの読み込みに失敗しました。リンクが壊れているか、対応していない形式です。通常の入力を続けられます。
        </p>
      )}

      <details className="group rounded-control border border-slate-200 bg-white">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-700 group-open:border-b group-open:border-slate-200">
          CSVから取り込む（部署・社員名簿・選好行列をまとめて設定する場合はこちら）
        </summary>
        <div className="p-4">
          <ImportPanel
            mode="full"
            onImported={() => {
              navigate(ROUTES.matching.preferences);
            }}
          />
        </div>
      </details>

      <SetupWizard isSample={isSample} />
    </div>
  );
}
