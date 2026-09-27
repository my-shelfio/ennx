import { useEffect, useState } from "react";

/**
 * 現在時刻を `intervalMs` ごとに更新して返す(残り時間表示などの定期再描画用)。
 * `enabled` が false の間はタイマーを止める(最初の更新は有効化から `intervalMs` 後)。
 */
export function useNow(intervalMs: number, enabled = true): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, enabled]);

  return now;
}
