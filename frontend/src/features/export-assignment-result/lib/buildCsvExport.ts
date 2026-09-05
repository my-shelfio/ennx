import type { AssignmentInput, AssignmentResult } from "../../../entities/assignment";
import { UNASSIGNED } from "../../../entities/assignment";
import { toCsvRow } from "../../../shared/lib";

/**
 * 割り当て結果の CSV 組み立て。
 *
 * CSV のエスケープ・行組み立ては shared/lib（csv.ts）を使う（features 同士は互いに
 * import できないため、マッチング側のエクスポートと共通の処理は shared に置く規約）。
 *
 * 分数はサーバーが返した既約分数の文字列をそのまま出す。表計算ソフトで開くと
 * 「1/2」は日付や文字列として解釈されうるが、丸めた小数を配ると行の合計が 1 に
 * ならず「なぜ合わないのか」という疑問を生むため、厳密値を正とする。あわせて
 * 小数の近似列を添えて、集計したい場合はそちらを使えるようにする。
 */

/** 抽選結果（社員ごとの配属先）の CSV。説明資料にそのまま貼れる最小の表。 */
export function buildDrawnAssignmentCsv(result: AssignmentResult): string {
  const lines = [toCsvRow(["社員名", "配属先", "抽選シード"])];
  result.employee_names.forEach((name, employee) => {
    const department = result.drawn_assignment[employee] ?? UNASSIGNED;
    lines.push(
      toCsvRow([
        name,
        department === UNASSIGNED
          ? "未配属"
          : (result.department_names[department] ?? `部署${department + 1}`),
        String(result.seed),
      ]),
    );
  });
  return lines.join("\r\n");
}

/** 期待割当行列の CSV（厳密な分数と、その小数近似の 2 列組）。 */
export function buildExpectedAssignmentCsv(result: AssignmentResult): string {
  const columns = [...result.department_names, "未配属"];
  const header = ["社員名", ...columns.flatMap((label) => [label, `${label}（小数）`])];
  const lines = [toCsvRow(header)];

  result.expected_assignment.forEach((row, employee) => {
    const cells = row.flatMap((value) => [value, decimalOf(value)]);
    lines.push(toCsvRow([result.employee_names[employee] ?? `社員${employee + 1}`, ...cells]));
  });
  return lines.join("\r\n");
}

/** 分数文字列を小数表記（小数第 6 位まで、末尾の 0 は落とす）にする。 */
function decimalOf(value: string): string {
  const [numerator, denominator] = value.split("/");
  const top = Number(numerator);
  const bottom = denominator === undefined ? 1 : Number(denominator);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) {
    return "";
  }
  return String(Number((top / bottom).toFixed(6)));
}

/** 入力（受け入れ人数・希望順位）の CSV。再実行のための控えとして添える。 */
export function buildInputCsv(input: AssignmentInput, result: AssignmentResult): string {
  const lines = [toCsvRow(["種別", "名前", "値"])];
  result.department_names.forEach((name, department) => {
    lines.push(toCsvRow(["受け入れ人数", name, String(input.capacities[department] ?? 0)]));
  });
  input.agent_prefs.forEach((prefs, employee) => {
    const names = prefs.map(
      (department) => result.department_names[department - 1] ?? `部署${department}`,
    );
    lines.push(
      toCsvRow([
        "希望順位",
        result.employee_names[employee] ?? `社員${employee + 1}`,
        names.join(" > "),
      ]),
    );
  });
  return lines.join("\r\n");
}
