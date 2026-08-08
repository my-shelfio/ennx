import type { MatchingEvent } from "../../../entities/matching";

/**
 * イベントのテキスト説明（種別・理由）を組み立てる。
 * proposer=社員（提案者）、receiver=部署（受入者）。
 */
export interface EventDescription {
  /** イベント種別の表示名（凡例・ステップ見出しに使う）。 */
  title: string;
  /** 対象・理由を含む説明文。 */
  detail: string;
}

function nameOf(names: readonly string[], index: number, prefix: string): string {
  return names[index] ?? `${prefix}${index + 1}`;
}

/**
 * @param isFinalStep 当該イベントが再生の最終ステップかどうか。`tentative_accept` /
 *   `promote` は最終ステップであれば「確定」として表示する（{@link highlightedEdgeForEvent}
 *   の `confirm` 判定と表現を揃え、図とテキスト説明が食い違わないようにする）。
 */
export function describeEvent(
  event: MatchingEvent,
  proposerNames: readonly string[],
  receiverNames: readonly string[],
  isFinalStep = false,
): EventDescription {
  const receiverName = nameOf(receiverNames, event.receiver, "部署");
  const proposerName =
    event.proposer !== null ? nameOf(proposerNames, event.proposer, "社員") : null;
  const reasonSuffix = event.reason !== null && event.reason !== undefined ? `（${event.reason}）` : "";

  switch (event.event_type) {
    case "propose":
      return { title: "提案", detail: `${proposerName}が${receiverName}に提案しました。` };
    case "tentative_accept":
      return isFinalStep
        ? { title: "確定", detail: `${receiverName}が${proposerName}を確定受入しました。` }
        : { title: "仮受入", detail: `${receiverName}が${proposerName}を仮受入しました。` };
    case "reject":
      return {
        title: "棄却",
        detail: `${receiverName}が${proposerName}を拒否しました${reasonSuffix}。`,
      };
    case "waitlist":
      return {
        title: "待機",
        detail: `${receiverName}が${proposerName}を待機リストに追加しました。`,
      };
    case "promote":
      return isFinalStep
        ? {
            title: "確定（繰り上げ）",
            detail: `${receiverName}が待機リストから${proposerName}を繰り上げ、確定受入しました。`,
          }
        : {
            title: "繰り上げ受入",
            detail: `${receiverName}が待機リストから${proposerName}を繰り上げ受入しました。`,
          };
    case "cutoff_raise":
      return {
        title: "カットオフ引き上げ",
        detail: `${receiverName}のカットオフを引き上げました${reasonSuffix}。`,
      };
    default:
      return { title: event.event_type, detail: "" };
  }
}
