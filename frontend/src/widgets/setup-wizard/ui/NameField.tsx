import { FieldErrorText } from "./FieldErrorText";

interface NameFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  // exactOptionalPropertyTypes: 呼び出し側は `string | undefined` の式（Record アクセス等）を
  // そのまま渡すため、undefined を明示的に許容する。
  error?: string | undefined;
  /**
   * 入力を妨げない警告メッセージ（例: 名前の重複）。`error` とは異なり、赤字の
   * ブロッキングエラー表現（FieldErrorText）ではなく警告色で表示する。
   */
  warning?: string | undefined;
}

/**
 * 名前入力フィールド（ラベル + テキスト入力 + インラインエラー/警告）。
 * 空欄は「未入力」を表し、送信時にデフォルト名（社員N・部署N）へフォールバックする。
 */
export function NameField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  warning,
}: NameFieldProps) {
  const errorId = `${id}-error`;
  const warningId = `${id}-warning`;
  const describedBy = error !== undefined ? errorId : warning !== undefined ? warningId : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className="mt-1 h-10 w-full min-w-0 rounded-control border border-slate-300 px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      />
      <FieldErrorText id={errorId} message={error} />
      {error === undefined && warning !== undefined && (
        <p id={warningId} className="mt-1 text-xs text-warning-700">
          {warning}
        </p>
      )}
    </div>
  );
}
