/**
 * 部署 → 社員の選好（receiver_prefs）を「全部署共通の評価順位」から組み立てるための純粋関数。
 *
 * 実務では部署ごとの評価順を持っていることは少なく、人事評価など全部署共通の順位が 1 本だけ
 * あることが多い。そこで入力画面では共通の順位を 1 行だけ入力し、それを全部署へ展開する
 * モードを設ける。個別に変えたい部署だけは「上書き（override）」として独自の行を持つ。
 * 受入側の選好が全部署で同一でもマッチングの入力としては問題ないため、API の形式
 * （部署ごとの 1-indexed 社員番号リスト）は変えず、送信前に必ず展開した形で保持する。
 */

import type { RankCell, RankMatrix } from "./preferenceMatrix";
import { isRowEmpty } from "./preferenceMatrix";

/** 部署 → 社員の選好の入力方式。 */
export type ReceiverPrefsMode = "per_department" | "common";

/** 共通評価順位モードの設定（ストアに保存する形）。 */
export interface ReceiverPrefsSettings {
  mode: ReceiverPrefsMode;
  /** 全部署共通の評価順位（1-indexed の社員番号を希望順に並べたもの）。 */
  commonPrefs: number[];
  /** 部署ごとに「個別に設定」しているか（true の部署は共通順位で上書きしない）。 */
  overrides: boolean[];
}

export const createDefaultReceiverPrefsSettings = (): ReceiverPrefsSettings => ({
  mode: "per_department",
  commonPrefs: [],
  overrides: [],
});

/**
 * 保存済みの設定を現在の規模（社員数・部署数）に合わせて正規化する。
 * 以前の保存データ（この設定を持たない）や、設定後に規模が変わった場合でも
 * 安全に読み込めるようにする。
 * - mode が不明な値なら部署ごとモードとして扱う
 * - 共通順位から範囲外・重複の社員番号を取り除く
 * - overrides を部署数に合わせて切り詰め・false で補う
 */
export function normalizeReceiverPrefsSettings(
  settings: Partial<ReceiverPrefsSettings> | null | undefined,
  employeeCount: number,
  departmentCount: number,
): ReceiverPrefsSettings {
  const mode: ReceiverPrefsMode = settings?.mode === "common" ? "common" : "per_department";
  const seen = new Set<number>();
  const commonPrefs = (Array.isArray(settings?.commonPrefs) ? settings.commonPrefs : []).filter(
    (employee) => {
      if (!Number.isInteger(employee) || employee < 1 || employee > employeeCount) {
        return false;
      }
      if (seen.has(employee)) {
        return false;
      }
      seen.add(employee);
      return true;
    },
  );
  const savedOverrides = Array.isArray(settings?.overrides) ? settings.overrides : [];
  const overrides = Array.from(
    { length: departmentCount },
    (_, department) => savedOverrides[department] === true,
  );
  return { mode, commonPrefs, overrides };
}

function rowsEqual(a: readonly RankCell[], b: readonly RankCell[]): boolean {
  return a.length === b.length && a.every((cell, index) => cell === b[index]);
}

/**
 * 共通順位の行を、個別設定していない部署の行へ展開した新しい行列を返す
 * （個別設定の部署の行はそのまま残す）。
 * 返り値を prefsFromMatrix で変換したものが、そのまま API に送る receiver_prefs になる。
 */
export function applyCommonRow(
  matrix: RankMatrix,
  commonRow: readonly RankCell[],
  overrides: readonly boolean[],
): RankMatrix {
  return matrix.map((row, department) => (overrides[department] === true ? row : [...commonRow]));
}

/**
 * 部署ごとモードから共通モードへ切り替えるときの overrides を決める。
 * 入力済みで共通順位と異なる部署は「個別に設定」扱いにし、切り替えによって
 * 部署ごとの入力が失われないようにする（未入力・共通順位と同じ部署は共通順位を使う）。
 * 以前から個別に設定していた部署はその設定を保つ。
 */
export function overridesOnEnterCommonMode(
  matrix: RankMatrix,
  commonRow: readonly RankCell[],
  previousOverrides: readonly boolean[],
): boolean[] {
  return matrix.map(
    (row, department) =>
      previousOverrides[department] === true || (!isRowEmpty(row) && !rowsEqual(row, commonRow)),
  );
}
