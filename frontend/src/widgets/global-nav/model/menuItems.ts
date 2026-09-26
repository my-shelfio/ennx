import { ROUTES } from "../../../shared/config";

export interface MenuItem {
  id: string;
  label: string;
  /** 遷移先パス。準備中の項目は undefined（クリック不可）。 */
  path?: string;
  /**
   * 現在地ハイライトの判定に使うパスプレフィックス（未指定時は path と同じ）。
   * "/" は完全一致のみ、それ以外は前方一致（サブパス含む）で判定する。
   */
  matchPrefix?: string;
  /** true の場合「準備中」バッジを表示しクリック不可にする。 */
  comingSoon?: boolean;
  /** 準備中項目の説明（ツールチップ・タイトル属性として表示）。 */
  description?: string;
}

/**
 * グローバルナビのメニュー定義。
 * 表記はホームのカード表記（モジュール名）に統一する。リンク先は各モジュールの
 * 実行画面とし、再訪ユーザーが導入ページを経由せずに直行できるようにする
 * （導入ページへはホームのカードから遷移する）。
 * 将来追加予定のモジュール（インセンティブ設計）は「準備中」表示でクリック不可にする。
 * 次のモジュールを追加する際は、このマッピング表を拡張判断の基準にする。
 */
export const MENU_ITEMS: readonly MenuItem[] = [
  {
    id: "home",
    label: "ホーム",
    path: ROUTES.home,
    matchPrefix: "/",
  },
  {
    id: "matching",
    label: "配属マッチング",
    path: ROUTES.matching.setup,
    matchPrefix: "/matching",
  },
  {
    id: "assignment",
    label: "割り当て",
    path: ROUTES.assignment.run,
    matchPrefix: "/assignment",
  },
  {
    id: "voting",
    label: "投票・合意形成",
    path: ROUTES.voting.create,
    matchPrefix: "/voting",
  },
  {
    id: "incentive-design",
    label: "インセンティブ設計",
    comingSoon: true,
    description: "契約理論・インセンティブ設計に基づく機能を準備中です。",
  },
] as const;

/** 現在地（pathname）がメニュー項目に対応するかを判定する（現在地ハイライト用）。 */
export function isMenuItemActive(item: MenuItem, pathname: string): boolean {
  const prefix = item.matchPrefix ?? item.path;
  if (prefix === undefined) {
    return false;
  }
  if (prefix === "/") {
    return pathname === "/";
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
