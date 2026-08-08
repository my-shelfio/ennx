import type { MatchingEvent } from "../../../entities/matching";

/**
 * 当該ステップで変化したエッジのハイライト種別。
 * 当該ステップで変化したエッジをアニメーションでハイライトするために使う。
 */
export type EdgeKind = "propose" | "tentative" | "confirm" | "reject" | "waitlist" | "cutoff";

export interface HighlightedEdge {
  proposerIndex: number | null;
  receiverIndex: number;
  kind: EdgeKind;
}

/**
 * イベントからハイライト対象のエッジを決定する。
 * `tentative_accept` / `promote` は、それが最終ステップであれば「確定」、
 * そうでなければ「仮受入」として扱う（DA/FDA/CA いずれも最終ラウンドの受入が確定となるため）。
 */
export function highlightedEdgeForEvent(event: MatchingEvent, isFinalStep: boolean): HighlightedEdge {
  const kind = eventKind(event.event_type, isFinalStep);
  return { proposerIndex: event.proposer, receiverIndex: event.receiver, kind };
}

function eventKind(eventType: string, isFinalStep: boolean): EdgeKind {
  switch (eventType) {
    case "cutoff_raise":
      return "cutoff";
    case "tentative_accept":
    case "promote":
      return isFinalStep ? "confirm" : "tentative";
    case "reject":
      return "reject";
    case "waitlist":
      return "waitlist";
    default:
      return "propose";
  }
}
