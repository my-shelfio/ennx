import { Button } from "../../../shared/ui";

interface NgPairFieldProps {
  employeeLabels: readonly string[];
  pairs: readonly (readonly number[])[];
  onChange: (pairs: number[][]) => void;
}

/**
 * NG ペア（同じ部署に配属しない社員の組）の入力。
 *
 * 注意: 同じ社員を含む組を鎖状に登録すると制約集合が交差し、期待割当を
 * 確定的な配属のくじに分解できなくなる（サーバー側が実行前に弾く）。
 * その旨をヘルプとして添える。
 */
export function NgPairField({ employeeLabels, pairs, onChange }: NgPairFieldProps) {
  const update = (index: number, position: 0 | 1, value: string) => {
    const next = pairs.map((pair) => [...pair]);
    const target = next[index];
    if (target === undefined) {
      return;
    }
    target[position] = Number(value);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {pairs.map((pair, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          {([0, 1] as const).map((position) => (
            <select
              key={position}
              className="rounded-control border border-slate-300 bg-white px-2 py-1 text-sm"
              aria-label={`NG ペア ${index + 1} の社員 ${position + 1}`}
              value={pair[position] ?? 0}
              onChange={(event) => update(index, position, event.target.value)}
            >
              {employeeLabels.map((label, employeeIndex) => (
                <option key={label} value={employeeIndex}>
                  {label}
                </option>
              ))}
            </select>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(pairs.filter((_, i) => i !== index).map((p) => [...p]))}
          >
            削除
          </Button>
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={employeeLabels.length < 2}
          onClick={() => onChange([...pairs.map((pair) => [...pair]), [0, 1]])}
        >
          NG ペアを追加
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        同じ社員を含む組を連鎖させると（例: 社員1-社員2 と 社員2-社員3）、制約どうしが
        交差して確定的な配属のくじに分解できなくなります。その場合は実行時にエラーで通知します。
      </p>
    </div>
  );
}
