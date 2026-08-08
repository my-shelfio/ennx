import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { useAnalyticsConfig } from "../../features/analytics";
import { loadAnalytics, trackPageView } from "../../shared/lib";

/**
 * GA4 の初回読み込みと、SPA のルート変更ごとのページビュー送信をまとめて行う。
 *
 * `useAnalyticsConfig` が測定IDを返さない（開発環境・ローカル、または取得失敗）間は
 * 何もしない。初めて測定IDが得られたタイミングで `loadAnalytics` を1回だけ呼び、
 * 以降はパス変更のたびに `trackPageView` を呼ぶ（初回分もこの呼び出しでまとめて送る）。
 */
export function useAnalyticsTracking(): void {
  const { data } = useAnalyticsConfig();
  const location = useLocation();
  const isLoadedRef = useRef(false);

  useEffect(() => {
    const measurementId = data?.gaMeasurementId;
    if (measurementId === null || measurementId === undefined) {
      return;
    }
    if (!isLoadedRef.current) {
      isLoadedRef.current = true;
      loadAnalytics(measurementId);
    }
    trackPageView(location.pathname);
  }, [data?.gaMeasurementId, location.pathname]);
}
