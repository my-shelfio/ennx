import { FieldErrorText } from "./FieldErrorText";

interface NumberFieldProps {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  /** 選択肢の最小値（含む）。 */
  min: number;
  /** 選択肢の最大値（含む）。不正な値の入力を防ぐため、自由入力ではなく選択式にする。 */
  max: number;
  // exactOptionalPropertyTypes: 呼び出し側は `string | undefined` の式（Record アクセス等）を
  // そのまま渡すため、undefined を明示的に許容する。
  error?: string | undefined;
  className?: string;
}

/** 数値選択フィールド（ラベル + select[min〜max の整数] + インラインエラー）。 */
export function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  error,
  className,
}: NumberFieldProps) {
  const errorId = `${id}-error`;
  const optionCount = Math.max(0, max - min + 1);
  const options = Array.from({ length: optionCount }, (_, index) => min + index);

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === "" ? null : Number(raw));
        }}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : undefined}
        className="mt-1 h-10 w-full min-w-0 rounded-control border border-slate-300 px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <option value="">選択してください</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <FieldErrorText id={errorId} message={error} />
    </div>
  );
}
