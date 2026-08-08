import type { MatchingEvent } from "../model/types";

/**
 * イベントログの 1 ステップ分のスナップショット。
 * ステップ再生ビューアはこの配列を先頭から順に表示する。
 */
export interface MatchingStepSnapshot {
  /** 0-indexed のステップ番号（events 配列のインデックスと一致）。 */
  stepIndex: number;
  /** このステップで発生したイベント。 */
  event: MatchingEvent;
  /** このステップ適用後の配属状態（社員ごとの部署 0-index。-1 = 未配属）。 */
  proposerMatch: number[];
  /** このステップ適用後の配属状態（部署ごとの社員 0-index リスト、昇順）。 */
  receiverMatch: number[][];
}

/**
 * イベントログから各ステップの配属状態を再構成する。
 *
 * バックエンドの `reconstruct_matching`（backend/src/domain/matching/events.py）と
 * 同じ再構成ルールを TypeScript に移植したもの。最終ステップの結果は
 * `/api/v1/matching/run` の `proposer_match`/`receiver_match` と一致する
 * （契約はイベントログ契約テストで保証）。
 *
 * 再構成ルール:
 *   - tentative_accept / promote: 提案者を受入者に割り当てる（別の受入者に
 *     割り当て済みなら付け替える）
 *   - reject: 提案者がその受入者に割り当て済みであれば解除する
 *   - propose / waitlist / cutoff_raise: 割り当て状態を変化させない
 */
export function parseMatchingEvents(
  events: MatchingEvent[],
  proposerCount: number,
  receiverCount: number,
): MatchingStepSnapshot[] {
  const proposerMatch = new Array<number>(proposerCount).fill(-1);
  const receiverMatch: Set<number>[] = Array.from(
    { length: receiverCount },
    () => new Set<number>(),
  );

  return events.map((event, stepIndex) => {
    applyEvent(event, proposerMatch, receiverMatch);

    return {
      stepIndex,
      event,
      proposerMatch: [...proposerMatch],
      receiverMatch: receiverMatch.map((set) => [...set].sort((a, b) => a - b)),
    };
  });
}

function applyEvent(
  event: MatchingEvent,
  proposerMatch: number[],
  receiverMatch: Set<number>[],
): void {
  if (event.event_type === "tentative_accept" || event.event_type === "promote") {
    if (event.proposer === null) {
      throw new Error(`${event.event_type} イベントには proposer が必要です`);
    }
    const proposer = event.proposer;
    const previousReceiver = proposerMatch[proposer] ?? -1;
    if (previousReceiver !== -1) {
      receiverMatch[previousReceiver]?.delete(proposer);
    }
    proposerMatch[proposer] = event.receiver;
    receiverMatch[event.receiver]?.add(proposer);
    return;
  }

  if (event.event_type === "reject") {
    if (event.proposer === null) {
      throw new Error("reject イベントには proposer が必要です");
    }
    const proposer = event.proposer;
    if (proposerMatch[proposer] === event.receiver) {
      proposerMatch[proposer] = -1;
      receiverMatch[event.receiver]?.delete(proposer);
    }
    return;
  }

  // propose / waitlist / cutoff_raise: 割り当て状態を変化させない
}
