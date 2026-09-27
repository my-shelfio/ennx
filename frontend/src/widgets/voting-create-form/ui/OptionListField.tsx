import { useState } from "react";

import { MAX_OPTION_DESCRIPTION_LENGTH, MAX_OPTIONS, MIN_OPTIONS } from "../../../entities/voting";
import { Button } from "../../../shared/ui";

import { FieldErrorText } from "./FieldErrorText";

export interface OptionListValue {
  options: string[];
  /** 選択肢ごとの補足説明（options と同じ長さ。説明なしは空文字）。 */
  descriptions: string[];
}

export interface OptionListFieldProps extends OptionListValue {
  /** 選択肢と補足説明は常に同じ長さ・同じ並びで更新する。 */
  onChange: (next: OptionListValue) => void;
  error?: string | undefined;
  descriptionError?: string | undefined;
}

/**
 * 投票の選択肢(案)の動的入力リスト(2〜10件)。
 * 追加・削除ボタンで件数を調整する(最小件数を下回る削除・最大件数を超える追加は無効化する)。
 * 各選択肢には任意の補足説明を付けられる(未入力の間は折りたたみ、ボタンで開く)。
 */
export function OptionListField({
  options,
  descriptions,
  onChange,
  error,
  descriptionError,
}: OptionListFieldProps) {
  // 説明欄を開いた選択肢の位置。説明が入力済みの選択肢は常に開いて表示する。
  const [openedIndices, setOpenedIndices] = useState<ReadonlySet<number>>(new Set());

  function handleOptionChange(index: number, value: string) {
    const next = [...options];
    next[index] = value;
    onChange({ options: next, descriptions });
  }

  function handleDescriptionChange(index: number, value: string) {
    const next = [...descriptions];
    next[index] = value;
    onChange({ options, descriptions: next });
  }

  function handleAdd() {
    if (options.length >= MAX_OPTIONS) {
      return;
    }
    onChange({ options: [...options, ""], descriptions: [...descriptions, ""] });
  }

  function handleRemove(index: number) {
    if (options.length <= MIN_OPTIONS) {
      return;
    }
    onChange({
      options: options.filter((_, i) => i !== index),
      descriptions: descriptions.filter((_, i) => i !== index),
    });
    // 削除位置より後ろの選択肢は位置が 1 つ繰り上がる。
    setOpenedIndices(
      (prev) =>
        new Set(
          [...prev].filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)),
        ),
    );
  }

  function handleOpenDescription(index: number) {
    setOpenedIndices((prev) => new Set(prev).add(index));
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">選択肢(案)</label>
      <div className="mt-1 flex flex-col gap-3">
        {options.map((option, index) => {
          const description = descriptions[index] ?? "";
          const isDescriptionOpen = description.length > 0 || openedIndices.has(index);
          const descriptionId = `voting-option-description-${index}`;
          return (
            <div key={index} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(event) => handleOptionChange(index, event.target.value)}
                  aria-label={`選択肢${index + 1}`}
                  className="h-10 w-full min-w-0 rounded-control border border-slate-300 px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  placeholder={`選択肢${index + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(index)}
                  disabled={options.length <= MIN_OPTIONS}
                  aria-label={`選択肢${index + 1}を削除`}
                >
                  削除
                </Button>
              </div>
              {isDescriptionOpen ? (
                <textarea
                  id={descriptionId}
                  value={description}
                  onChange={(event) => handleDescriptionChange(index, event.target.value)}
                  aria-label={`選択肢${index + 1}の補足説明`}
                  rows={2}
                  maxLength={MAX_OPTION_DESCRIPTION_LENGTH}
                  className="w-full min-w-0 rounded-control border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  placeholder={`補足説明(任意・${MAX_OPTION_DESCRIPTION_LENGTH}文字以内)。例: 費用感・期間など`}
                />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => handleOpenDescription(index)}
                >
                  ＋ 補足説明を追加
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={handleAdd}
        disabled={options.length >= MAX_OPTIONS}
      >
        選択肢を追加
      </Button>
      <FieldErrorText message={error} />
      <FieldErrorText message={descriptionError} />
    </div>
  );
}
