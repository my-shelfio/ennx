import type { MatchingEvent, MatchingStepSnapshot } from "../../../entities/matching";

/**
 * イベント種別フィルタ。`"all"` は全種別を対象とする（フィルタなし）。
 * 値は docs/event-schema.md の `EventType` と対応する。
 */
export type EventTypeFilter =
  | "all"
  | "propose"
  | "tentative_accept"
  | "reject"
  | "waitlist"
  | "promote"
  | "cutoff_raise";

/** イベント種別フィルタの選択肢（表示順）。 */
export const EVENT_TYPE_FILTER_OPTIONS: readonly { value: EventTypeFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "propose", label: "提案のみ" },
  { value: "tentative_accept", label: "仮受入のみ" },
  { value: "reject", label: "棄却のみ" },
  { value: "waitlist", label: "待機のみ" },
  { value: "promote", label: "繰り上げのみ" },
  { value: "cutoff_raise", label: "カットオフのみ" },
];

function matchesEventTypeFilter(event: MatchingEvent, filter: EventTypeFilter): boolean {
  return filter === "all" || event.event_type === filter;
}

/**
 * 追跡対象社員（0-indexed、`proposer`）が当該イベントに関与しているかどうか。
 * `employeeIndex` が `null`（追跡なし）の場合は常に true を返す。
 */
function matchesTrackedEmployee(event: MatchingEvent, employeeIndex: number | null): boolean {
  return employeeIndex === null || event.proposer === employeeIndex;
}

/**
 * イベント種別フィルタ・社員追跡の両条件（AND）を満たすステップのインデックス一覧を返す。
 *
 * 呼び出し側（StepPlayer）では `snapshots` / `eventFilter` / `trackedEmployeeIndex` が
 * 変化したときだけ `useMemo` で再計算し、ステップ移動のたびに全走査しないようにする
 * （最大規模: 部署50・社員100 相当のイベントログでも遅延なく動作させるための対応）。
 * このインデックス一覧はスキップ移動の移動先を絞るためだけに使い、`snapshots` 本体や
 * 表示上のステップ配列・インデックスはいっさい変更しない。
 */
export function buildFilteredStepIndices(
  snapshots: readonly MatchingStepSnapshot[],
  eventFilter: EventTypeFilter,
  trackedEmployeeIndex: number | null,
): number[] {
  const indices: number[] = [];
  snapshots.forEach((snapshot, index) => {
    if (
      matchesEventTypeFilter(snapshot.event, eventFilter) &&
      matchesTrackedEmployee(snapshot.event, trackedEmployeeIndex)
    ) {
      indices.push(index);
    }
  });
  return indices;
}

/** ソート済みの `filteredStepIndices` から `currentStep` の直後に来るステップ番号を返す（なければ null）。 */
export function nextFilteredStep(
  filteredStepIndices: readonly number[],
  currentStep: number,
): number | null {
  return filteredStepIndices.find((index) => index > currentStep) ?? null;
}

/** ソート済みの `filteredStepIndices` から `currentStep` の直前に来るステップ番号を返す（なければ null）。 */
export function previousFilteredStep(
  filteredStepIndices: readonly number[],
  currentStep: number,
): number | null {
  let result: number | null = null;
  for (const index of filteredStepIndices) {
    if (index >= currentStep) {
      break;
    }
    result = index;
  }
  return result;
}

/**
 * 指定社員（0-indexed）の配属が確定したステップのインデックスを返す。
 *
 * 「確定」は、最終スナップショットの配属状態と一致する割り当てを発生させた
 * 直近の `tentative_accept` / `promote` イベントのステップとする。イベント列を
 * 末尾から探索して最初に見つかったその社員の割り当てイベントを返せば、それ以降
 * その社員への割り当て変更（再割り当て・拒否）が発生していないことが保証される
 * （`parseMatchingEvents` の再構成ルール上、割り当て状態は該当イベントでしか変化しない）。
 *
 * 最終的にその社員が未配属（-1）の場合は確定ステップが存在しないため null を返す。
 */
export function findEmployeeConfirmedStepIndex(
  snapshots: readonly MatchingStepSnapshot[],
  employeeIndex: number,
): number | null {
  const finalSnapshot = snapshots.at(-1);
  if (finalSnapshot === undefined) {
    return null;
  }
  const finalDepartment = finalSnapshot.proposerMatch[employeeIndex];
  if (finalDepartment === undefined || finalDepartment === -1) {
    return null;
  }

  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    const snapshot = snapshots[index];
    if (snapshot === undefined) {
      continue;
    }
    const { event } = snapshot;
    const isAssignEvent = event.event_type === "tentative_accept" || event.event_type === "promote";
    if (isAssignEvent && event.proposer === employeeIndex) {
      return index;
    }
  }
  return null;
}
