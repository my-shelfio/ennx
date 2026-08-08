interface FieldErrorTextProps {
  id?: string;
  // exactOptionalPropertyTypes: 呼び出し側は `string | undefined` の式（Record アクセス等）を
  // そのまま渡すため、undefined を明示的に許容する。
  message?: string | undefined;
}

/**
 * フィールド直下のインライン日本語エラーメッセージ。
 * ウィザード内部でのみ使用する（スライスの公開 API には含めない）。
 */
export function FieldErrorText({ id, message }: FieldErrorTextProps) {
  if (message === undefined) {
    return null;
  }
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-danger-600">
      {message}
    </p>
  );
}
