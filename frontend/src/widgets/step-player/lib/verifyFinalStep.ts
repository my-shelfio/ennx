import type { MatchingResult } from "../../../entities/matching";
import { parseMatchingEvents } from "../../../entities/matching";

/**
 * イベントログの最終ステップを再構成した配属状態が、結果画面の配属結果
 * （`MatchingResult.proposer_match`）と一致することを検証する。
 *
 * ステップ再生の最終ステップの配属状態が結果画面と一致していることを保証するための
 * 検証で、バックエンドの契約テストでも保証されるが、フロント側でも独立して検証する。
 */
export function finalStepMatchesResult(result: MatchingResult): boolean {
  if (result.events.length === 0) {
    return result.proposer_match.every((departmentIndex) => departmentIndex === -1);
  }

  const snapshots = parseMatchingEvents(
    result.events,
    result.employee_names.length,
    result.department_names.length,
  );
  const finalSnapshot = snapshots.at(-1);
  if (finalSnapshot === undefined) {
    return false;
  }

  return (
    finalSnapshot.proposerMatch.length === result.proposer_match.length &&
    finalSnapshot.proposerMatch.every((value, index) => value === result.proposer_match[index])
  );
}
