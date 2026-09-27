import { describe, expect, it } from "vitest";

import type { AdminSession } from "../model/types";

import { buildDuplicateFormValues, readDuplicateFormValues } from "./duplicate";
import { MAX_DEADLINE_DAYS, validateVotingCreateForm } from "./validation";

const session: AdminSession = {
  title: "来期の懇親会の会場",
  options: ["案A", "案B", "案C"],
  option_descriptions: ["駅近", "", "予算内"],
  method: "approval",
  deadline: "2026-09-30T09:00:00Z",
  expires_at: "2026-10-01T09:00:00Z",
  is_closed: true,
  publish_results: true,
  ballot_count: 5,
  participant_token: "p-token",
  voters: ["v1", "v2", "v3", "v4", "v5"],
};

describe("buildDuplicateFormValues", () => {
  it("タイトル・選択肢・補足説明・方式・結果公開の設定を引き継ぎ、締切は既定値に戻す", () => {
    expect(buildDuplicateFormValues(session)).toEqual({
      title: "来期の懇親会の会場",
      options: ["案A", "案B", "案C"],
      optionDescriptions: ["駅近", "", "予算内"],
      method: "approval",
      deadlineDays: MAX_DEADLINE_DAYS,
      publishResults: true,
    });
  });

  it("作成画面で選べない方式キーは未選択にし、補足説明の欠けは空文字で補う", () => {
    const values = buildDuplicateFormValues({
      ...session,
      method: "unknown",
      option_descriptions: ["駅近"],
    });
    expect(values.method).toBe("");
    expect(values.optionDescriptions).toEqual(["駅近", "", ""]);
  });

  it("組み立てたフォーム値はそのまま入力検証を通る", () => {
    expect(validateVotingCreateForm(buildDuplicateFormValues(session))).toEqual({});
  });
});

describe("readDuplicateFormValues", () => {
  it("複製の state からフォーム値を取り出す", () => {
    const duplicate = buildDuplicateFormValues(session);
    expect(readDuplicateFormValues({ duplicate })).toEqual(duplicate);
  });

  it.each([
    ["state なし", null],
    ["duplicate なし", { other: 1 }],
    ["選択肢が文字列配列でない", { duplicate: { ...buildDuplicateFormValues(session), options: [1] } }],
    [
      "補足説明と選択肢の件数が食い違う",
      { duplicate: { ...buildDuplicateFormValues(session), optionDescriptions: [""] } },
    ],
  ])("%s なら null を返す", (_, state) => {
    expect(readDuplicateFormValues(state)).toBeNull();
  });
});
