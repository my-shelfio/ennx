declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loadedMeasurementId: string | null = null;

/**
 * GA4（Google Analytics 4）のスクリプトを読み込み、初期化する。
 *
 * 呼び出しは冪等（同一・別IDいずれの再呼び出しも既読込のIDがあれば何もしない）。
 * ページビューの自動送信は無効化し（`send_page_view: false`）、SPA のルート変更を
 * 検知した呼び出し元（`trackPageView`）が明示的に送信する。GA4 は
 * `/api/v1/meta/analytics-config` が測定IDを返した場合のみ（＝本番環境のみ）呼び出される。
 * カスタムイベント・入力データの送信は一切行わない（計測はページビューのみ）。
 */
export function loadAnalytics(measurementId: string): void {
  if (loadedMeasurementId !== null) {
    return;
  }
  loadedMeasurementId = measurementId;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", measurementId, {
    send_page_view: false,
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
}

/**
 * SPA のルート変更をページビューとして送信する。
 * `loadAnalytics` 未実行（GA4 無効環境）では `window.gtag` が存在しないため何もしない。
 */
export function trackPageView(path: string): void {
  window.gtag?.("event", "page_view", { page_path: path });
}
