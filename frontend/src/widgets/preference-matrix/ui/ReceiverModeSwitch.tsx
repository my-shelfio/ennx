import type { ReceiverPrefsMode } from "../../../entities/matching";
import { cn } from "../../../shared/lib";

export interface ReceiverModeSwitchProps {
  mode: ReceiverPrefsMode;
  onChange: (mode: ReceiverPrefsMode) => void;
}

const OPTIONS: { value: ReceiverPrefsMode; label: string; description: string }[] = [
  {
    value: "per_department",
    label: "部署ごとに設定",
    description: "部署ごとに社員の順位を入力します。",
  },
  {
    value: "common",
    label: "全部署で共通の評価順位を使う",
    description: "人事評価など 1 本の順位を全部署に使います。個別に変えたい部署だけ上書きできます。",
  },
];

/**
 * 部署 → 社員の選好の入力方式（部署ごと / 全部署共通の評価順位）を切り替えるラジオボタン。
 */
export function ReceiverModeSwitch({ mode, onChange }: ReceiverModeSwitchProps) {
  return (
    <fieldset className="flex flex-col gap-2 sm:flex-row sm:gap-3">
      <legend className="sr-only">部署 → 社員の入力方式</legend>
      {OPTIONS.map((option) => {
        const id = `receiver-mode-${option.value}`;
        const checked = mode === option.value;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className={cn(
              "flex min-h-11 flex-1 cursor-pointer items-start gap-2 rounded-control border px-3 py-2",
              checked ? "border-primary-400 bg-primary-50" : "border-slate-200 bg-white",
            )}
          >
            <input
              id={id}
              type="radio"
              name="receiver-mode"
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="mt-1 h-4 w-4 accent-primary-600"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-slate-900">{option.label}</span>
              <span className="text-xs text-slate-500">{option.description}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
