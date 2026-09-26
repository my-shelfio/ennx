import type { AssignmentEvent } from "../model/types";
import { UNASSIGNED } from "../model/types";

/**
 * イーティング過程のイベントログを、ステップ再生で 1 手ずつ追える形に整形する。
 *
 * PS は連続時間で進むため、イベントは「同じ時刻区間（step）に属するイベント群」に
 * まとまる。1 ステップ = 1 つの時刻区間として、その区間で誰が何を食べたか・
 * 何が起きて区間が終わったかをまとめる。
 */
export interface TimelineStep {
  /** 区間番号（1 始まり）。 */
  step: number;
  /** 区間の開始時刻（分数文字列）。 */
  start: string;
  /** 区間の終了時刻（分数文字列）。 */
  end: string;
  /** 区間で消費した量（分数文字列）。 */
  amount: string;
  /** 社員ごとの消費先。`consumption[i]` は部署 index（UNASSIGNED = 未配属）。 */
  consumption: number[];
  /** 区間の終わりに起きたこと（供給の枯渇・制約の飽和）の説明。 */
  notes: string[];
}

/**
 * イベントログをステップ単位に畳み込む。
 *
 * @param events run レスポンスの events[]
 * @param employeeCount 社員数（消費先の配列長を揃えるために使う）
 */
export function buildTimeline(
  events: readonly AssignmentEvent[],
  employeeCount: number,
): TimelineStep[] {
  const steps = new Map<number, TimelineStep>();

  for (const event of events) {
    const current =
      steps.get(event.step) ??
      ({
        step: event.step,
        start: event.start,
        end: event.end,
        amount: "0",
        consumption: Array.from({ length: employeeCount }, () => UNASSIGNED),
        notes: [],
      } satisfies TimelineStep);

    if (event.event_type === "consume") {
      if (event.employee !== null && event.employee !== undefined) {
        current.consumption[event.employee] = event.department ?? UNASSIGNED;
      }
      current.amount = event.amount ?? current.amount;
    } else if (event.reason) {
      current.notes.push(event.reason);
    }
    steps.set(event.step, current);
  }

  return [...steps.values()].sort((a, b) => a.step - b.step);
}
