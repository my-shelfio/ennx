import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AssignmentPage } from "../pages/assignment";
import { HomePage } from "../pages/home";
import { PreferencesPage } from "../pages/preferences";
import { ResultPage } from "../pages/result";
import { SetupWizardPage } from "../pages/setup";
import { VotingCreatePage } from "../pages/voting-create";
import { VotingManagePage } from "../pages/voting-manage";
import { VotingParticipatePage } from "../pages/voting-participate";
import { LEGACY_ROUTES, ROUTES } from "../shared/config";

import { AppLayout } from "./layout/AppLayout";
import { AppProviders } from "./lib/AppProviders";

/**
 * 旧 URL（LEGACY_ROUTES）から新パスへのリダイレクト。
 * クエリ文字列（例: 旧 "/setup?sample=1"）を維持したまま新パスへ転送する。
 */
function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

/**
 * アプリのルートコンポーネント。
 * Router・各種プロバイダ（AppProviders）・共通レイアウト（AppLayout）を配線する。
 * マッチング機能は "/matching/" 配下に名前空間化する（将来の複数モジュール化に備え）。
 * "/matching/setup" は設定ウィザード、"/matching/preferences" は選好行列エディタ、
 * "/matching/result" は結果画面。旧パス（LEGACY_ROUTES）はブックマーク・共有リンクの
 * 互換性を保つため恒久的にリダイレクトする（未定義パスは "*" でホームへフォールバックする）。
 * 割り当て（PS メカニズム）は "/assignment" に置く。
 * 投票・合意形成モジュールは "/voting/" 配下に名前空間化する。
 * "/voting/create" は作成、"/voting/v/:token" は参加、"/voting/m/:token" は管理（結果確認・削除）。
 */
export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path={ROUTES.home} element={<HomePage />} />
            <Route path={ROUTES.matching.setup} element={<SetupWizardPage />} />
            <Route path={ROUTES.matching.preferences} element={<PreferencesPage />} />
            <Route path={ROUTES.matching.result} element={<ResultPage />} />
            <Route path={ROUTES.assignment.root} element={<AssignmentPage />} />
            <Route path={ROUTES.voting.create} element={<VotingCreatePage />} />
            <Route path={ROUTES.voting.participate} element={<VotingParticipatePage />} />
            <Route path={ROUTES.voting.manage} element={<VotingManagePage />} />
            <Route
              path={LEGACY_ROUTES.setup}
              element={<LegacyRedirect to={ROUTES.matching.setup} />}
            />
            <Route
              path={LEGACY_ROUTES.preferences}
              element={<LegacyRedirect to={ROUTES.matching.preferences} />}
            />
            <Route
              path={LEGACY_ROUTES.result}
              element={<LegacyRedirect to={ROUTES.matching.result} />}
            />
            <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProviders>
  );
}
