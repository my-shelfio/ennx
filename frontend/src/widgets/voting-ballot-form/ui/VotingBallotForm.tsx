import { useState, type FormEvent } from "react";

import {
  buildBallotRequestBody,
  isBallotComplete,
  MAX_VOTER_NAME_LENGTH,
} from "../../../entities/voting";
import type { BallotFormValues, BallotRequestBody, VotingMethod } from "../../../entities/voting";
import { cn } from "../../../shared/lib";
import { Button } from "../../../shared/ui";

export interface VotingBallotFormProps {
  options: string[];
  method: VotingMethod;
  onSubmit: (body: BallotRequestBody) => void;
  isSubmitting: boolean;
  /** 前回投票時に使用したニックネーム（同一端末での再訪問時の入力補完用）。 */
  initialVoterName?: string;
}

/**
 * 選択肢番号 [0, 1, ..., length-1] をランダムな順序にして返す（Fisher-Yates）。
 * レビュー指摘対応: 順位付け方式の初期表示順を常に選択肢の登録順（=常に選択肢0が
 * 最上位）にすると、並び替えを一切行わずに送信した場合に特定の案が体系的に有利になる
 * バイアスが生じるため、初期順序をランダム化して緪和する。
 */
function shuffledIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, index) => index);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = indices[i];
    const b = indices[j];
    if (a === undefined || b === undefined) {
      continue;
    }
    indices[i] = b;
    indices[j] = a;
  }
  return indices;
}

/**
 * 投票フォーム。
 * 投票方式に応じて入力形式を切り替える(多数決=単一選択・承認投票=複数選択・
 * 順位付け=並び替え)。送信内容は `buildBallotRequestBody` で method に応じた
 * フィールドのみを組み立てる。
 */
export function VotingBallotForm({
  options,
  method,
  onSubmit,
  isSubmitting,
  initialVoterName = "",
}: VotingBallotFormProps) {
  const [voterName, setVoterName] = useState(initialVoterName);
  const [choice, setChoice] = useState<number | null>(null);
  const [approvals, setApprovals] = useState<number[]>([]);
  // 遅延初期化（引数なし関数）で初回マウント時のみランダム化し、再レンダーのたびに
  // 順序が変わらないようにする。
  const [ranking, setRanking] = useState<number[]>(() => shuffledIndices(options.length));

  const values: BallotFormValues = {
    method,
    numOptions: options.length,
    voterName,
    choice,
    ranking: method === "ranking" ? ranking : null,
    approvals,
  };
  const canSubmit = isBallotComplete(values);

  function toggleApproval(index: number) {
    setApprovals((prev) =>
      prev.includes(index) ? prev.filter((value) => value !== index) : [...prev, index],
    );
  }

  function moveRanking(position: number, direction: -1 | 1) {
    const target = position + direction;
    if (target < 0 || target >= ranking.length) {
      return;
    }
    const next = [...ranking];
    const moved = next[position];
    const swapped = next[target];
    if (moved === undefined || swapped === undefined) {
      return;
    }
    next[position] = swapped;
    next[target] = moved;
    setRanking(next);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) {
      return;
    }
    onSubmit(buildBallotRequestBody(values));
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="voter-name" className="block text-sm font-medium text-slate-700">
          ニックネーム（必須・本名でなくても構いません。例: 社員番号など）
        </label>
        <input
          id="voter-name"
          type="text"
          required
          maxLength={MAX_VOTER_NAME_LENGTH}
          value={voterName}
          onChange={(event) => setVoterName(event.target.value)}
          className="mt-1 h-10 w-full min-w-0 rounded-control border border-slate-300 bg-white px-3 text-sm text-slate-900"
          placeholder="例: 12345 / たろう"
        />
        <p className="mt-1 text-xs text-slate-500">
          入力したニックネームは主催者に表示されます。同じニックネームで再度投票すると、
          前回の投票を上書きします。
        </p>
      </div>

      {method === "plurality" ? (
        <fieldset>
          <legend className="block text-sm font-medium text-slate-700">1つ選んでください</legend>
          <div className="mt-2 flex flex-col gap-2">
            {options.map((option, index) => (
              <label
                key={index}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-control border p-3",
                  choice === index ? "border-primary-400 bg-primary-50" : "border-slate-200",
                )}
              >
                <input
                  type="radio"
                  name="ballot-choice"
                  checked={choice === index}
                  onChange={() => setChoice(index)}
                />
                <span className="text-sm text-slate-900">{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {method === "approval" ? (
        <fieldset>
          <legend className="block text-sm font-medium text-slate-700">
            賛成できる案をいくつでも選んでください(0件も可)
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            {options.map((option, index) => (
              <label
                key={index}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-control border p-3",
                  approvals.includes(index)
                    ? "border-primary-400 bg-primary-50"
                    : "border-slate-200",
                )}
              >
                <input
                  type="checkbox"
                  checked={approvals.includes(index)}
                  onChange={() => toggleApproval(index)}
                />
                <span className="text-sm text-slate-900">{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {method === "ranking" ? (
        <fieldset>
          <legend className="block text-sm font-medium text-slate-700">
            好ましい順にすべての案を並べてください(上ほど好ましい)
          </legend>
          <ol className="mt-2 flex flex-col gap-2">
            {ranking.map((optionIndex, position) => (
              <li
                key={optionIndex}
                className="flex items-center justify-between gap-3 rounded-control border border-slate-200 p-3"
              >
                <span className="text-sm text-slate-900">
                  {position + 1}. {options[optionIndex]}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveRanking(position, -1)}
                    disabled={position === 0}
                    aria-label={`${options[optionIndex]}を上へ`}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveRanking(position, 1)}
                    disabled={position === ranking.length - 1}
                    aria-label={`${options[optionIndex]}を下へ`}
                  >
                    ↓
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </fieldset>
      ) : null}

      <Button type="submit" disabled={!canSubmit || isSubmitting}>
        {isSubmitting ? "送信しています…" : "投票する"}
      </Button>
    </form>
  );
}
