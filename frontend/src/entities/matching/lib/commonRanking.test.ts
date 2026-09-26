import { describe, expect, test } from "vitest";

import {
  applyCommonRow,
  normalizeReceiverPrefsSettings,
  overridesOnEnterCommonMode,
} from "./commonRanking";
import type { RankMatrix } from "./preferenceMatrix";
import { createEmptyMatrix, matrixFromPrefs, prefsFromMatrix } from "./preferenceMatrix";

describe("applyCommonRow", () => {
  test("共通順位だけで全部署の receiver_prefs が同一内容で埋まる", () => {
    // 社員 3 人・部署 2 件。共通順位 = 社員3 → 社員1 → 社員2。
    const [commonRow] = matrixFromPrefs([[3, 1, 2]], 3);
    const expanded = applyCommonRow(createEmptyMatrix(2, 3), commonRow ?? [], [false, false]);
    expect(prefsFromMatrix(expanded)).toEqual([
      [3, 1, 2],
      [3, 1, 2],
    ]);
  });

  test("個別設定の部署は自分の行を保ち、それ以外は共通順位になる（API に送る値と一致）", () => {
    const current: RankMatrix = matrixFromPrefs([[1, 2], [2], [1]], 3);
    const [commonRow] = matrixFromPrefs([[2, 3, 1]], 3);
    const expanded = applyCommonRow(current, commonRow ?? [], [false, true, false]);
    expect(prefsFromMatrix(expanded)).toEqual([[2, 3, 1], [2], [2, 3, 1]]);
  });

  test("共通順位が部分的（一部の社員のみ）でもそのまま展開する", () => {
    const [commonRow] = matrixFromPrefs([[2]], 3);
    const expanded = applyCommonRow(createEmptyMatrix(1, 3), commonRow ?? [], []);
    expect(prefsFromMatrix(expanded)).toEqual([[2]]);
  });
});

describe("normalizeReceiverPrefsSettings", () => {
  test("以前の保存データ（設定なし）は部署ごとモードとして読み込む", () => {
    expect(normalizeReceiverPrefsSettings(undefined, 3, 2)).toEqual({
      mode: "per_department",
      commonPrefs: [],
      overrides: [false, false],
    });
  });

  test("規模の変更後は範囲外・重複の社員番号を除き、overrides を部署数に合わせる", () => {
    expect(
      normalizeReceiverPrefsSettings(
        { mode: "common", commonPrefs: [4, 2, 2, 1, 0], overrides: [true, false, true, true] },
        3,
        3,
      ),
    ).toEqual({ mode: "common", commonPrefs: [2, 1], overrides: [true, false, true] });
  });

  test("不明な mode は部署ごとモードとして扱う", () => {
    const settings = { mode: "unknown" } as unknown as Parameters<
      typeof normalizeReceiverPrefsSettings
    >[0];
    expect(normalizeReceiverPrefsSettings(settings, 1, 1).mode).toBe("per_department");
  });
});

describe("overridesOnEnterCommonMode", () => {
  test("入力済みで共通順位と異なる部署だけを個別設定にし、部署ごとの入力を失わない", () => {
    const current: RankMatrix = matrixFromPrefs([[], [1, 2], [2, 1], [3]], 3);
    const [commonRow] = matrixFromPrefs([[1, 2]], 3);
    const overrides = overridesOnEnterCommonMode(current, commonRow ?? [], [false, false, false, true]);
    // 部署1: 未入力 → 共通 / 部署2: 共通と同じ → 共通 / 部署3: 異なる → 個別 / 部署4: 以前から個別
    expect(overrides).toEqual([false, false, true, true]);

    const expanded = applyCommonRow(current, commonRow ?? [], overrides);
    expect(prefsFromMatrix(expanded)).toEqual([[1, 2], [1, 2], [2, 1], [3]]);
  });
});
