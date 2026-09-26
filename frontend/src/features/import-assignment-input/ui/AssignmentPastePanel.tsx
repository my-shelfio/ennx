import { useMemo, useState } from "react";

import type { AssignmentInput } from "../../../entities/assignment";
import { ApiError } from "../../../shared/api";
import { Button, useToast } from "../../../shared/ui";
import { parsePastedAssignment } from "../lib/parsePastedAssignment";
import type { PastedAssignment } from "../lib/parsePastedAssignment";
import { useValidateAssignmentInput } from "../model/useValidateAssignmentInput";

export interface AssignmentPastePanelProps {
  /** 現在の社員数（規模が変わる場合の案内に使う）。 */
  currentEmployeeCount: number;
  /** 現在の部署数（規模が変わる場合の案内に使う）。 */
  currentDepartmentCount: number;
  employeeMax: number;
  departmentMax: number;
  /**
   * 貼り付け内容を入力へ反映し、反映後の入力を返す。規模の変更（受け入れ人数・追加制約の
   * 調整を含む）は入力フォーム側の規則に従うため、呼び出し側で行う。
   */
  onApply: (pasted: PastedAssignment) => AssignmentInput;
  /** 反映と事前検証が終わった後のハンドラ（パネルを閉じる等）。 */
  onApplied?: () => void;
}

/**
 * 割り当て（PS）の希望順位を、Excel 等からコピーした範囲の貼り付けで取り込むパネル
 * （貼り付け → プレビュー → 反映）。
 *
 * 形式は配属マッチングの社員 → 部署と同じ「行 = 社員、列 = 部署、セル = 希望順位」。
 * 社員数・部署数は貼り付けに合わせて変更し、変わる場合はプレビューで案内する。
 * 反映後は `POST /api/v1/assignment/validate` で事前検証し、結果をトーストで知らせる。
 */
export function AssignmentPastePanel({
  currentEmployeeCount,
  currentDepartmentCount,
  employeeMax,
  departmentMax,
  onApply,
  onApplied,
}: AssignmentPastePanelProps) {
  const [text, setText] = useState("");
  const validateMutation = useValidateAssignmentInput();
  const { toast } = useToast();

  const preview = useMemo(
    () => (text.trim() === "" ? null : parsePastedAssignment(text, { employeeMax, departmentMax })),
    [text, employeeMax, departmentMax],
  );

  const pasted = preview?.pasted ?? null;
  const scaleChanges: string[] = [];
  if (pasted !== null && pasted.employeeCount !== currentEmployeeCount) {
    scaleChanges.push(`社員数 ${currentEmployeeCount} → ${pasted.employeeCount} 人`);
  }
  if (pasted !== null && pasted.departmentCount !== currentDepartmentCount) {
    scaleChanges.push(`部署数 ${currentDepartmentCount} → ${pasted.departmentCount} 件`);
  }

  function handleApply() {
    if (pasted === null) {
      return;
    }
    const nextInput = onApply(pasted);
    validateMutation.mutate(nextInput, {
      onSuccess: (result) => {
        toast(
          result.valid
            ? { title: "貼り付けた希望順位を反映しました", variant: "ok" }
            : {
                title: "反映しましたが、検証エラーがあります",
                description: (result.errors ?? []).map((error) => error.message).join(" "),
                variant: "warning",
              },
        );
        setText("");
        onApplied?.();
      },
      onError: (error) => {
        toast({
          title: "反映しましたが、事前検証に失敗しました",
          description:
            error instanceof ApiError
              ? error.fieldErrors.map((fieldError) => fieldError.message).join(" ")
              : `${error.message}。内容はフォームに反映されています。`,
          variant: "warning",
        });
        setText("");
        onApplied?.();
      },
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-control border border-slate-200 bg-slate-50 p-4">
      <div>
        <label
          htmlFor="assignment-paste-text"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Excel などでコピーした範囲を貼り付け
        </label>
        <p className="mb-2 text-xs text-slate-500">
          行 = 社員、列 = 部署、セル = 希望順位（1, 2, 3 …。希望しない部署は空欄）。1
          行目の部署名・1 列目の社員名はあってもなくても構いません（ある場合は名前も取り込みます）。
        </p>
        <textarea
          id="assignment-paste-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={"\t部署1\t部署2\n社員1\t1\t2\n社員2\t2\t1"}
          className="block w-full rounded-control border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        />
      </div>

      {preview !== null ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold text-slate-900">
            貼り付け内容のプレビュー: 社員 {preview.employeeCount} 人 × 部署{" "}
            {preview.departmentCount} 件
          </p>
          {preview.tableErrors.length > 0 || preview.rowErrors.length > 0 ? (
            <div className="rounded-control border border-danger-200 bg-danger-50 p-3" role="alert">
              <p className="mb-1 font-semibold text-danger-700">
                反映できません（{preview.tableErrors.length + preview.rowErrors.length}件のエラー）
              </p>
              <ul className="list-disc space-y-1 pl-5 text-danger-700">
                {preview.tableErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
                {preview.rowErrors.map((error) => (
                  <li key={error.rowIndex}>
                    {error.rowName === ""
                      ? `${error.rowIndex + 1}行目`
                      : `「${error.rowName}」行（${error.rowIndex + 1}行目）`}
                    : {error.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-slate-600">
              エラーはありません。反映すると、現在の希望順位はすべて置き換わります。
              {scaleChanges.length > 0
                ? `規模が変わります（${scaleChanges.join("・")}）。増えた部署の受け入れ人数は 1 人になり、追加の制約（同じ部署に配属しない組）は解除されます。`
                : null}
            </p>
          )}
          <div>
            <Button
              type="button"
              disabled={pasted === null || validateMutation.isPending}
              onClick={handleApply}
            >
              {validateMutation.isPending ? "反映中…" : "この内容で反映"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
