import { Link, Outlet } from "react-router-dom";

import { ClearDataButton } from "../../features/clear-data";
import { ROUTES } from "../../shared/config";
import { GlobalNav } from "../../widgets/global-nav";

import { useAnalyticsTracking } from "./useAnalyticsTracking";

const PRIVACY_POLICY_URL = "https://system-solution-developers.github.io/Documents/ennx/privacy-policy.html";
const TERMS_OF_SERVICE_URL = "https://system-solution-developers.github.io/Documents/ennx/terms-of-service.html";

/**
 * 全ページ共通のレイアウト（ヘッダー・フッター）。
 * 各ページは <Outlet /> の位置に描画される。
 * ヘッダー左側にグローバルナビ（widgets/global-nav）のハンバーガーボタンを常設し、
 * 将来の複数モジュール化（情報共有・インセンティブ設計）に備えたドロワーメニューへの
 * 導線とする（#114）。
 * ヘッダーの「入力データをクリア」ボタンは、共有端末利用後に入力データを
 * 消去できる導線を UI に常設するため、特定ページではなく全ページ共通のここに配置する。
 * フッターには免責文言と利用規約・プライバシーポリシーへの
 * リンクを常設する。`useAnalyticsTracking` が GA4 の初回読み込みとルート変更ごとの
 * ページビュー送信を担う（本番環境のみ有効化）。
 */
export function AppLayout() {
  useAnalyticsTracking();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <GlobalNav />
            <Link
              to={ROUTES.home}
              className="text-lg font-bold tracking-tight text-slate-900"
            >
              ennx
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <p className="hidden text-xs text-slate-500 sm:block">
              組織の問題を可視化し、意思決定を支援する
            </p>
            <ClearDataButton />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-center text-xs text-slate-400 sm:px-6">
          <p>
            ennx ── 組織の問題を経済学の理論で可視化し、意思決定を支援する個人開発プロジェクトです。
            本サービスが出力する結果・レポートは意思決定の参考情報であり、決定を保証・代行するものではありません。
          </p>
          <p>
            アクセス状況の把握のため Google アナリティクスを利用しています（入力データは送信されません）。
          </p>
          <p className="flex justify-center gap-4">
            <a
              href={TERMS_OF_SERVICE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-600"
            >
              利用規約
            </a>
            <a
              href={PRIVACY_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-600"
            >
              プライバシーポリシー
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
