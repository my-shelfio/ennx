interface PreferenceRowProps {
  employeeLabel: string;
  departmentLabels: readonly string[];
  /** 希望順位（1-indexed の部署番号、好きな順）。 */
  prefs: readonly number[];
  onChange: (prefs: number[]) => void;
}

/**
 * 1 人分の希望順位入力。
 * 「第 1 希望・第 2 希望…」のプルダウンを部署数ぶん並べ、未選択（希望しない）も選べる。
 * 部署の側は候補者を順位づけしないため、入力は社員側の 1 行だけで完結する。
 */
export function PreferenceRow({
  employeeLabel,
  departmentLabels,
  prefs,
  onChange,
}: PreferenceRowProps) {
  const handleChange = (rank: number, value: string) => {
    const next = [...prefs];
    if (value === "") {
      next.splice(rank);
    } else {
      next[rank] = Number(value);
      // 同じ部署を後段でも選んでいたら取り除く（重複を UI で作らせない）。
      for (let i = next.length - 1; i > rank; i -= 1) {
        if (next[i] === Number(value)) {
          next.splice(i, 1);
        }
      }
    }
    onChange(next.filter((department) => Number.isFinite(department)));
  };

  return (
    <tr className="hover:bg-slate-50">
      <th scope="row" className="px-3 py-2 text-left text-sm font-medium text-slate-700">
        {employeeLabel}
      </th>
      {departmentLabels.map((_, rank) => (
        <td key={rank} className="px-3 py-2">
          <select
            className="w-full rounded-control border border-slate-300 bg-white px-2 py-1 text-sm"
            aria-label={`${employeeLabel}の第${rank + 1}希望`}
            value={prefs[rank] ?? ""}
            onChange={(event) => handleChange(rank, event.target.value)}
          >
            <option value="">選択しない</option>
            {departmentLabels.map((label, index) => (
              <option
                key={label}
                value={index + 1}
                disabled={prefs.includes(index + 1) && prefs[rank] !== index + 1}
              >
                {label}
              </option>
            ))}
          </select>
        </td>
      ))}
    </tr>
  );
}
