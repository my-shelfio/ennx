const MINUTE_MS = 60 * 1000;
const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;
/** 残り時間表示を更新する間隔(表示の最小単位である1分)。 */
export const REMAINING_REFRESH_MS = MINUTE_MS;
/** 締切間近として強調表示する残り時間の閾値(24時間)。 */
const URGENT_THRESHOLD_MS = DAY_MINUTES * MINUTE_MS;

export interface RemainingTime {
  /** 表示文字列(例: 「あと2日5時間」「あと3時間10分」「締切まで30分」「締切を過ぎました」)。 */
  text: string;
  /** 残り24時間以内(締切超過は含まない)。 */
  isUrgent: boolean;
  /** 締切時刻に達した(または過ぎた)。 */
  isOver: boolean;
}

/**
 * 締切日時と現在時刻から残り時間の表示を組み立てる純粋関数。
 * 現在時刻は引数で受け取る(表示側で定期的に更新する)。
 * 残りは分単位に切り上げ(1秒でも残っていれば「締切まで1分」)、日・時間の表示は
 * 下位の単位を切り捨てる(「あと2日5時間」は 2日5時間以上2日6時間未満)。
 */
export function formatRemaining(deadline: Date, now: Date): RemainingTime {
  const remainingMs = deadline.getTime() - now.getTime();
  if (remainingMs <= 0) {
    return { text: "締切を過ぎました", isUrgent: false, isOver: true };
  }

  const totalMinutes = Math.ceil(remainingMs / MINUTE_MS);
  const days = Math.floor(totalMinutes / DAY_MINUTES);
  const hours = Math.floor((totalMinutes % DAY_MINUTES) / HOUR_MINUTES);
  const minutes = totalMinutes % HOUR_MINUTES;
  const isUrgent = remainingMs <= URGENT_THRESHOLD_MS;

  let text: string;
  if (days > 0) {
    text = hours > 0 ? `あと${days}日${hours}時間` : `あと${days}日`;
  } else if (hours > 0) {
    text = minutes > 0 ? `あと${hours}時間${minutes}分` : `あと${hours}時間`;
  } else {
    text = `締切まで${minutes}分`;
  }
  return { text, isUrgent, isOver: false };
}
