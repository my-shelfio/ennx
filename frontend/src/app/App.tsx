import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AssignmentPage } from "../pages/assignment";
import { AssignmentIntroPage } from "../pages/assignment-intro";
import { HomePage } from "../pages/home";
import { MatchingIntroPage } from "../pages/matching-intro";
import { PreferencesPage } from "../pages/preferences";
import { ResultPage } from "../pages/result";
import { SetupWizardPage } from "../pages/setup";
import { VotingCreatePage } from "../pages/voting-create";
import { VotingIntroPage } from "../pages/voting-intro";
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
 *
 * 各モジュールは名前空間直下を導入ページ（何を解決するか・どう使うかの説明）とし、
 * 実行画面は下位パスに置く。"/matching" は配属マッチングの導入、"/matching/setup" は
 * 設定ウィザード、"/matching/preferences" は選好行列エディタ、"/matching/result" は結果画面。
 * "/assignment" は割り当ての導入、"/assignment/run" は実行画面。
 * "/voting" は投票・合意形成の導入、"/voting/create" は作成、"/voting/v/:token" は参加、
 * "/voting/m/:token" は管理（結果確認・削除）。
 *
 * 旧パス（LEGACY_ROUTES）はブックマーク・共有リンクの互換性を保つため恒久的に
 * リダイレクトする（未定義パスは "*" でホームへフォールバックする）。
 * 一方 "/assignment" は導入ページとし、実行画面へのリダイレクトは行わない
 * （公開後日が浅く、外部共有リンクを生成する機能もないため）。
 */
export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path={ROUTES.home} element={<HomePage />} />
            <Route path={ROUTES.matching.intro} element={<MatchingIntroPage />} />
            <Route path={ROUTES.matching.setup} element={<SetupWizardPage />} />
            <Route path={ROUTES.matching.preferences} element={<PreferencesPage />} />
            <Route path={ROUTES.matching.result} element={<ResultPage />} />
            <Route path={ROUTES.assignment.intro} element={<AssignmentIntroPage />} />
            <Route path={ROUTES.assignment.run} element={<AssignmentPage />} />
            <Route path={ROUTES.voting.intro} element={<VotingIntroPage />} />
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
