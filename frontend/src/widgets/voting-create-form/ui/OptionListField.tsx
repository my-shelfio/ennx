import { MAX_OPTIONS, MIN_OPTIONS } from "../../../entities/voting";
import { Button } from "../../../shared/ui";

import { FieldErrorText } from "./FieldErrorText";

export interface OptionListFieldProps {
  options: string[];
  onChange: (options: string[]) => void;
  error?: string | undefined;
}

/**
 * 投票の選択肢(案)の動的入力リスト(2〜10件)。
 * 追加・削除ボタンで件数を調整する(最小件数を下回る削除・最大件数を超える追加は無効化する)。
 */
export function OptionListField({ options, onChange, error }: OptionListFieldProps) {
  function handleOptionChange(index: number, value: string) {
    const next = [...options];
    next[index] = value;
    onChange(next);
  }

  function handleAdd() {
    if (options.length >= MAX_OPTIONS) {
      return;
    }
    onChange([...options, ""]);
  }

  function handleRemove(index: number) {
    if (options.length <= MIN_OPTIONS) {
      return;
    }
    onChange(options.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">選択肢(案)</label>
      <div className="mt-1 flex flex-col gap-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
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
        ))}
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
    </div>
  );
}
