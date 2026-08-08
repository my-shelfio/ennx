interface FieldErrorListProps {
  messages: readonly string[];
}

/**
 * サーバー検証（RFC 9457 の `errors[]`）由来のフィールドエラー一覧表示。
 * ウィザード内部でのみ使用する。
 */
export function FieldErrorList({ messages }: FieldErrorListProps) {
  if (messages.length === 0) {
    return null;
  }
  return (
    <ul role="alert" className="mt-2 list-disc pl-4 text-xs text-danger-600">
      {messages.map((message, index) => (
        <li key={index}>{message}</li>
      ))}
    </ul>
  );
}
