import { useState } from "react";

import { resolveNames, useMatchingInputStore } from "../../../entities/matching";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, useToast } from "../../../shared/ui";
import { ApiError } from "../../../shared/api";
import { useValidateImportedInput } from "../model/useValidateImportedInput";
import { parseImportFiles } from "../lib/parseImportFiles";
import { IMPORT_FILE_NAMES } from "../lib/types";
import type { ImportFileRole, ImportPreview, RawImportFile } from "../lib/types";

import { PastePanel } from "./PastePanel";
import { TemplateDownloadLinks } from "./TemplateDownloadLinks";

export interface ImportPanelProps {
  /**
   * "full": settings.csv・employee_prefs.csv・department_prefs.csv の3種を受け付ける
   *   （設定ウィザードからの新規取込、pages/setup）。
   * "preferences": employee_prefs.csv・department_prefs.csv の2種のみを受け付け、
   *   既存の部署設定（定員・制約種別）は変更しない（選好入力画面からの再取込、pages/preferences）。
   */
  mode: "full" | "preferences";
  /** 取込確定（ストア反映と事前検証）が完了した後の遷移等のハンドラ。 */
  onImported: () => void;
  /**
   * 取り込んだ内容をストアへ書き込んだ直後（事前検証の応答を待つ前）に呼ぶハンドラ。
   * 表示中の入力エディタにストアの値を読み直させる用途（検証を待つ間に古い表示のまま
   * 編集されて、取り込んだ内容が上書きされるのを防ぐ）。
   */
  onStoreUpdated?: () => void;
}

const ROLES_BY_MODE: Record<ImportPanelProps["mode"], ImportFileRole[]> = {
  full: ["settings", "employee_prefs", "department_prefs"],
  preferences: ["employee_prefs", "department_prefs"],
};

async function readFiles(fileList: FileList): Promise<RawImportFile[]> {
  return Promise.all(
    Array.from(fileList).map(async (file) => ({
      fileName: file.name,
      text: await file.text(),
    })),
  );
}

type ImportSource = "file" | "paste";

/**
 * CSV一括インポートのパネル（ファイル選択 → 検証 → プレビュー → 確定）。
 * テンプレートのダウンロードもここに配置する。
 *
 * 選好入力画面からの再取込（mode = "preferences"）では、ファイル選択に加えて
 * Excel 等からの貼り付け（選好行列 1 つ分）を選べる。設定ウィザードからの新規取込は
 * 部署・定員も必要なため、ファイル取込のみとする。
 */
export function ImportPanel({ mode, onImported, onStoreUpdated }: ImportPanelProps) {
  const input = useMatchingInputStore((state) => state.input);
  const setBulkInput = useMatchingInputStore((state) => state.setBulkInput);
  const { toast } = useToast();
  const validateMutation = useValidateImportedInput();

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [source, setSource] = useState<ImportSource>("file");

  const allowedRoles = ROLES_BY_MODE[mode];

  async function handleFilesSelected(fileList: FileList | null) {
    if (fileList === null || fileList.length === 0) {
      return;
    }
    setIsReading(true);
    try {
      const rawFiles = await readFiles(fileList);
      const allowedFileNames = new Set(allowedRoles.map((role) => IMPORT_FILE_NAMES[role]));
      const usableFiles = rawFiles.filter((file) =>
        allowedFileNames.has(file.fileName.trim().toLowerCase()),
      );
      const ignoredFiles = rawFiles.filter(
        (file) => !allowedFileNames.has(file.fileName.trim().toLowerCase()),
      );

      const result = parseImportFiles(usableFiles, {
        requiredRoles: allowedRoles,
        ...(mode === "preferences"
          ? {
              expectedDepartmentNames: resolveNames(
                input.department_names,
                input.capacities.length,
                "部署",
              ),
              expectedEmployeeNames: resolveNames(
                input.employee_names,
                input.proposer_prefs.length,
                "社員",
              ),
            }
          : {}),
      });

      const ignoredIssues = ignoredFiles
        .filter((file) => Object.values(IMPORT_FILE_NAMES).includes(file.fileName.trim().toLowerCase()) === false)
        .map((file) => ({
          blocking: false,
          message: `ファイル「${file.fileName}」は認識できませんでした（${allowedRoles
            .map((role) => IMPORT_FILE_NAMES[role])
            .join(" / ")} のいずれかを選択してください）。このファイルは無視されました。`,
        }));
      const unsupportedRoleIssues = ignoredFiles
        .filter((file) => Object.values(IMPORT_FILE_NAMES).includes(file.fileName.trim().toLowerCase()))
        .map((file) => ({
          blocking: false,
          message: `${file.fileName} はこの画面からの取込では使用されません。無視されました。`,
        }));

      setPreview({
        ...result,
        issues: [...result.issues, ...ignoredIssues, ...unsupportedRoleIssues],
      });
    } catch (error) {
      toast({
        title: "ファイルの読み込みに失敗しました",
        description: error instanceof Error ? error.message : "不明なエラーです。",
        variant: "danger",
      });
    } finally {
      setIsReading(false);
    }
  }

  function handleConfirm() {
    if (preview === null || !preview.canConfirm) {
      return;
    }

    let nextInput: typeof input;

    if (mode === "full") {
      if (preview.capacities === null || preview.proposerPrefs === null || preview.receiverPrefs === null) {
        return;
      }
      setBulkInput({
        constraint_type: input.constraint_type === "" ? "capacity_only" : input.constraint_type,
        capacities: preview.capacities,
        department_names: preview.departmentNames,
        proposer_prefs: preview.proposerPrefs,
        receiver_prefs: preview.receiverPrefs,
        employee_names: preview.employeeNames,
      });
      nextInput = {
        ...input,
        constraint_type: input.constraint_type === "" ? "capacity_only" : input.constraint_type,
        capacities: preview.capacities,
        department_names: preview.departmentNames,
        proposer_prefs: preview.proposerPrefs,
        receiver_prefs: preview.receiverPrefs,
        employee_names: preview.employeeNames,
      };
    } else {
      if (preview.proposerPrefs === null || preview.receiverPrefs === null) {
        return;
      }
      const patch = {
        proposer_prefs: preview.proposerPrefs,
        receiver_prefs: preview.receiverPrefs,
        employee_names: preview.employeeNames ?? input.employee_names ?? null,
        department_names: preview.departmentNames ?? input.department_names ?? null,
      };
      // 取り込んだ部署→社員の選好は部署ごとの値のため、入力方式も部署ごとモードへ戻す
      // （setBulkInput は部署数が変わらない限り他の設定を保つ）。
      setBulkInput(patch);
      nextInput = { ...input, ...patch };
    }
    onStoreUpdated?.();

    validateMutation.mutate(nextInput, {
      onSuccess: (result) => {
        if (result.valid) {
          toast({ title: "CSVから取り込みました", variant: "ok" });
        } else {
          toast({
            title: "取り込みましたが、検証エラーがあります",
            description: "希望順位入力画面で内容を確認・修正してください。",
            variant: "warning",
          });
        }
        onImported();
      },
      onError: (error) => {
        toast({
          title: "取り込みましたが、事前検証に失敗しました",
          description:
            error instanceof ApiError
              ? error.fieldErrors.map((fieldError) => fieldError.message).join(" ")
              : `${error.message}。内容は保存されているため、希望順位入力画面から確認できます。`,
          variant: "warning",
        });
        onImported();
      },
    });
  }

  const blockingIssues = preview?.issues.filter((issue) => issue.blocking) ?? [];
  const nonBlockingIssues = preview?.issues.filter((issue) => !issue.blocking) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "full" ? "CSVから取り込む" : "CSV・Excelから取り込む"}</CardTitle>
        <CardDescription>
          {mode === "full"
            ? "テンプレートをダウンロードして記入し、settings.csv・employee_prefs.csv・department_prefs.csv の3ファイルを選択してください。"
            : source === "file"
              ? "テンプレートをダウンロードして記入し、employee_prefs.csv・department_prefs.csv の2ファイルを選択してください（部署・定員は変更されません）。"
              : "Excel などで希望順位の範囲をコピーし、貼り付けて取り込みます（部署・定員は変更されません）。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {mode === "preferences" ? (
          <div className="flex gap-2" role="group" aria-label="取り込み方法">
            {(
              [
                { value: "file", label: "CSVファイル" },
                { value: "paste", label: "貼り付け（Excel）" },
              ] as const
            ).map((option) => (
              <Button
                key={option.value}
                type="button"
                aria-pressed={source === option.value}
                variant={source === option.value ? "secondary" : "ghost"}
                size={null}
                className="h-11 px-4 text-sm"
                onClick={() => setSource(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        ) : null}

        {source === "paste" && mode === "preferences" ? (
          <PastePanel
            onImported={onImported}
            {...(onStoreUpdated !== undefined ? { onStoreUpdated } : {})}
          />
        ) : (
          <>
            <TemplateDownloadLinks roles={allowedRoles} />

            <div>
              <label
                htmlFor="import-input-file-picker"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                CSVファイルを選択（複数選択可）
              </label>
              <input
                id="import-input-file-picker"
                type="file"
                accept=".csv,text/csv"
                multiple
                onChange={(event) => {
                  void handleFilesSelected(event.target.files);
                }}
                className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-control file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700"
              />
            </div>

            {isReading ? <p className="text-sm text-slate-500">読み込んでいます…</p> : null}

            {preview !== null ? (
              <div className="flex flex-col gap-3 rounded-control border border-slate-200 bg-slate-50 p-4 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">取込内容のプレビュー</p>
                  <p className="text-slate-600">
                    部署数: {preview.departmentNames?.length ?? "-"}件 / 社員数:{" "}
                    {preview.employeeNames?.length ?? "-"}件
                  </p>
                </div>

                {blockingIssues.length > 0 ? (
                  <div className="rounded-control border border-danger-200 bg-danger-50 p-3">
                    <p className="mb-1 font-semibold text-danger-700">
                      取り込めません（{blockingIssues.length}件のエラー）
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-danger-700">
                      {blockingIssues.map((issue, index) => (
                        <li key={index}>{issue.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {nonBlockingIssues.length > 0 ? (
                  <div className="rounded-control border border-warning-200 bg-warning-50 p-3">
                    <p className="mb-1 font-semibold text-warning-700">
                      取り込み後に修正が必要な項目（{nonBlockingIssues.length}件）
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-warning-700">
                      {nonBlockingIssues.map((issue, index) => (
                        <li key={index}>{issue.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div>
                  <Button
                    type="button"
                    disabled={!preview.canConfirm || validateMutation.isPending}
                    onClick={handleConfirm}
                  >
                    {validateMutation.isPending ? "取り込み中…" : "この内容で取り込む"}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
