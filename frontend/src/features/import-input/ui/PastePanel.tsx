import { useMemo, useState } from "react";

import { resolveNames, useMatchingInputStore } from "../../../entities/matching";
import { ApiError } from "../../../shared/api";
import { cn } from "../../../shared/lib";
import { Button, useToast } from "../../../shared/ui";
import { parsePastedMatrix } from "../lib/parsePastedMatrix";
import type { PasteTarget } from "../lib/parsePastedMatrix";
import { useValidateImportedInput } from "../model/useValidateImportedInput";

export interface PastePanelProps {
  /** 反映（ストアへの書き込みと事前検証）が完了した後のハンドラ。 */
  onImported: () => void;
  /** ストアへ書き込んだ直後（事前検証の応答を待つ前）に呼ぶハンドラ。 */
  onStoreUpdated?: () => void;
}

const TARGETS: { value: PasteTarget; label: string; hint: string }[] = [
  {
    value: "employee_prefs",
    label: "社員 → 部署",
    hint: "行 = 社員、列 = 部署、セル = 希望順位（1, 2, 3 …）",
  },
  {
    value: "department_prefs",
    label: "部署 → 社員",
    hint: "行 = 部署、列 = 社員、セル = 優先順位（1, 2, 3 …）",
  },
];

/**
 * Excel 等でコピーした範囲を貼り付けて、選好行列 1 つ分を取り込むパネル
 * （貼り付け → プレビュー → 反映）。
 *
 * 規模・名前は現在の設定を正本とし、貼り付けの行数・列数（見出しがあれば名前と並び順）が
 * 一致しない場合や、順位の誤りがある行がある場合は反映しない。誤りのある行は行名つきで
 * 一覧表示する。反映後は CSV 取込と同じく事前検証（`POST /api/v1/matching/validate`）を
 * 通し、結果をトーストで知らせる。
 */
export function PastePanel({ onImported, onStoreUpdated }: PastePanelProps) {
  const input = useMatchingInputStore((state) => state.input);
  const setInput = useMatchingInputStore((state) => state.setInput);
  const setBulkInput = useMatchingInputStore((state) => state.setBulkInput);
  const validateMutation = useValidateImportedInput();
  const { toast } = useToast();

  const [target, setTarget] = useState<PasteTarget>("employee_prefs");
  const [text, setText] = useState("");

  const employeeNames = useMemo(
    () => resolveNames(input.employee_names, input.proposer_prefs.length, "社員"),
    [input.employee_names, input.proposer_prefs.length],
  );
  const departmentNames = useMemo(
    () => resolveNames(input.department_names, input.capacities.length, "部署"),
    [input.department_names, input.capacities.length],
  );

  const preview = useMemo(() => {
    if (text.trim() === "") {
      return null;
    }
    return parsePastedMatrix(
      text,
      target === "employee_prefs"
        ? {
            rowLabel: "社員",
            columnLabel: "部署",
            expectedRowNames: employeeNames,
            expectedColumnNames: departmentNames,
          }
        : {
            rowLabel: "部署",
            columnLabel: "社員",
            expectedRowNames: departmentNames,
            expectedColumnNames: employeeNames,
          },
    );
  }, [text, target, employeeNames, departmentNames]);

  const canApply = preview !== null && preview.prefs !== null && !validateMutation.isPending;

  function handleApply() {
    if (preview === null || preview.prefs === null) {
      return;
    }
    let nextInput: typeof input;
    if (target === "employee_prefs") {
      setInput({ proposer_prefs: preview.prefs });
      nextInput = { ...input, proposer_prefs: preview.prefs };
    } else {
      // 部署ごとの値を取り込むため、部署 → 社員の入力方式も部署ごとモードへ戻す。
      setBulkInput({ receiver_prefs: preview.prefs });
      nextInput = { ...input, receiver_prefs: preview.prefs };
    }
    onStoreUpdated?.();

    validateMutation.mutate(nextInput, {
      onSuccess: (result) => {
        toast(
          result.valid
            ? { title: "貼り付けた内容を反映しました", variant: "ok" }
            : {
                title: "反映しましたが、検証エラーがあります",
                description: (result.errors ?? []).map((error) => error.message).join(" "),
                variant: "warning",
              },
        );
        setText("");
        onImported();
      },
      onError: (error) => {
        toast({
          title: "反映しましたが、事前検証に失敗しました",
          description:
            error instanceof ApiError
              ? error.fieldErrors.map((fieldError) => fieldError.message).join(" ")
              : `${error.message}。内容は保存されています。`,
          variant: "warning",
        });
        setText("");
        onImported();
      },
    });
  }

  const currentTarget = TARGETS.find((option) => option.value === target) ?? TARGETS[0];

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">取り込み先</legend>
        {TARGETS.map((option) => {
          const id = `paste-target-${option.value}`;
          const checked = option.value === target;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-control border px-3 text-sm",
                checked ? "border-primary-400 bg-primary-50 text-slate-900" : "border-slate-300",
              )}
            >
              <input
                id={id}
                type="radio"
                name="paste-target"
                value={option.value}
                checked={checked}
                onChange={() => setTarget(option.value)}
                className="h-4 w-4 accent-primary-600"
              />
              {option.label}
            </label>
          );
        })}
      </fieldset>

      <div>
        <label htmlFor="paste-input-text" className="mb-1 block text-sm font-medium text-slate-700">
          Excel などでコピーした範囲を貼り付け
        </label>
        <p className="mb-2 text-xs text-slate-500">
          {currentTarget?.hint}。1 行目の見出し・1 列目の名前はあってもなくても構いません（ある場合は現在の設定と同じ名前・並び順にしてください）。
        </p>
        <textarea
          id="paste-input-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={"\t部署1\t部署2\n社員1\t1\t2\n社員2\t2\t1"}
          className="block w-full rounded-control border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        />
      </div>

      {preview !== null ? (
        <div className="flex flex-col gap-3 rounded-control border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">
            貼り付け内容のプレビュー: {preview.rowCount}行 × {preview.columnCount}列
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
                    「{error.rowName}」行（{error.rowIndex + 1}行目）: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-slate-600">
              エラーはありません。反映すると、現在の「{currentTarget?.label}」の希望順位はすべて置き換わります。
            </p>
          )}

          <div>
            <Button type="button" disabled={!canApply} onClick={handleApply}>
              {validateMutation.isPending ? "反映中…" : "この内容で反映"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
