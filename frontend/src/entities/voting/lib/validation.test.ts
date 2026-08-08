import { describe, expect, it } from "vitest";

import {
  buildBallotRequestBody,
  buildDeadlineIso,
  isBallotComplete,
  MAX_DEADLINE_DAYS,
  MAX_OPTION_LENGTH,
  MAX_OPTIONS,
  MAX_TITLE_LENGTH,
  MAX_VOTER_NAME_LENGTH,
  MIN_OPTIONS,
  validateVotingCreateForm,
} from "./validation";

describe("validateVotingCreateForm", () => {
  const base = { title: "次期プロジェクト名", options: ["案A", "案B"], method: "plurality" as const, deadlineDays: 7 };

  it("有効な入力ではエラーを返さない", () => {
    expect(validateVotingCreateForm(base)).toEqual({});
  });

  it("タイトルが空なら title エラー", () => {
    const errors = validateVotingCreateForm({ ...base, title: "  " });
    expect(errors.title).toBeDefined();
  });

  it(`タイトルが${MAX_TITLE_LENGTH}文字を超えると title エラー`, () => {
    const errors = validateVotingCreateForm({ ...base, title: "あ".repeat(MAX_TITLE_LENGTH + 1) });
    expect(errors.title).toBeDefined();
  });

  it(`選択肢が${MIN_OPTIONS}件未満なら options エラー`, () => {
    const errors = validateVotingCreateForm({ ...base, options: ["案A"] });
    expect(errors.options).toBeDefined();
  });

  it(`選択肢が${MAX_OPTIONS}件を超えると options エラー`, () => {
    const options = Array.from({ length: MAX_OPTIONS + 1 }, (_, i) => `案${i}`);
    const errors = validateVotingCreateForm({ ...base, options });
    expect(errors.options).toBeDefined();
  });

  it(`選択肢が${MAX_OPTION_LENGTH}文字を超えると options エラー`, () => {
    const errors = validateVotingCreateForm({
      ...base,
      options: ["あ".repeat(MAX_OPTION_LENGTH + 1), "案B"],
    });
    expect(errors.options).toBeDefined();
  });

  it("選択肢が重複していると options エラー", () => {
    const errors = validateVotingCreateForm({ ...base, options: ["案A", "案A"] });
    expect(errors.options).toBeDefined();
  });

  it("空欄の選択肢があると options エラー", () => {
    const errors = validateVotingCreateForm({ ...base, options: ["案A", "  "] });
    expect(errors.options).toBeDefined();
  });

  it("method 未選択なら method エラー", () => {
    const errors = validateVotingCreateForm({ ...base, method: "" });
    expect(errors.method).toBeDefined();
  });

  it(`deadlineDaysが範囲外（0や${MAX_DEADLINE_DAYS + 1}）なら deadlineDays エラー`, () => {
    expect(validateVotingCreateForm({ ...base, deadlineDays: 0 }).deadlineDays).toBeDefined();
    expect(
      validateVotingCreateForm({ ...base, deadlineDays: MAX_DEADLINE_DAYS + 1 }).deadlineDays,
    ).toBeDefined();
  });
});

describe("buildDeadlineIso", () => {
  it("指定日数後のISO文字列を返す", () => {
    const now = new Date("2026-07-20T00:00:00.000Z");
    expect(buildDeadlineIso(7, now)).toBe("2026-07-27T00:00:00.000Z");
  });
});

describe("buildBallotRequestBody", () => {
  it("plurality: choiceのみ送る", () => {
    expect(
      buildBallotRequestBody({ method: "plurality", numOptions: 3, voterName: "テスト太郎", choice: 1, ranking: null, approvals: [] }),
    ).toEqual({ voter_name: "テスト太郎", choice: 1, ranking: null, approvals: null });
  });

  it("approval: approvalsのみ送る", () => {
    expect(
      buildBallotRequestBody({ method: "approval", numOptions: 3, voterName: "テスト太郎", choice: null, ranking: null, approvals: [0, 2] }),
    ).toEqual({ voter_name: "テスト太郎", choice: null, ranking: null, approvals: [0, 2] });
  });

  it("ranking: rankingのみ送る", () => {
    expect(
      buildBallotRequestBody({ method: "ranking", numOptions: 3, voterName: "テスト太郎", choice: null, ranking: [2, 0, 1], approvals: [] }),
    ).toEqual({ voter_name: "テスト太郎", choice: null, ranking: [2, 0, 1], approvals: null });
  });

  it("ニックネームの前後の空白を除去して送る", () => {
    expect(
      buildBallotRequestBody({
        method: "plurality",
        numOptions: 3,
        voterName: "  テスト太郎  ",
        choice: 0,
        ranking: null,
        approvals: [],
      }),
    ).toEqual({ voter_name: "テスト太郎", choice: 0, ranking: null, approvals: null });
  });
});

describe("isBallotComplete", () => {
  it("plurality: choice未選択ならfalse", () => {
    expect(isBallotComplete({ method: "plurality", numOptions: 3, voterName: "テスト太郎", choice: null, ranking: null, approvals: [] })).toBe(
      false,
    );
    expect(isBallotComplete({ method: "plurality", numOptions: 3, voterName: "テスト太郎", choice: 0, ranking: null, approvals: [] })).toBe(
      true,
    );
  });

  it("approval: 常にtrue（0件承認も許容）", () => {
    expect(isBallotComplete({ method: "approval", numOptions: 3, voterName: "テスト太郎", choice: null, ranking: null, approvals: [] })).toBe(
      true,
    );
  });

  it("ranking: 全選択肢を含む順列でないとfalse", () => {
    expect(
      isBallotComplete({ method: "ranking", numOptions: 3, voterName: "テスト太郎", choice: null, ranking: [0, 1], approvals: [] }),
    ).toBe(false);
    expect(
      isBallotComplete({ method: "ranking", numOptions: 3, voterName: "テスト太郎", choice: null, ranking: [2, 0, 1], approvals: [] }),
    ).toBe(true);
  });

  it("ranking: 長さが一致していても重複・範囲外の値を含む場合はfalse（レビュー指摘対応）", () => {
    // 重複あり（1が2回、2が欠番）: 長さだけを見ると通過してしまう不備を検出する回帰テスト。
    expect(
      isBallotComplete({ method: "ranking", numOptions: 3, voterName: "テスト太郎", choice: null, ranking: [0, 1, 1], approvals: [] }),
    ).toBe(false);
    // 範囲外の値（3はnumOptions=3の範囲外、0-indexedなので0〜2が正しい）。
    expect(
      isBallotComplete({ method: "ranking", numOptions: 3, voterName: "テスト太郎", choice: null, ranking: [0, 1, 3], approvals: [] }),
    ).toBe(false);
  });

  it("ニックネームが未入力（空欄・空白のみ）ならfalse（必須項目）", () => {
    expect(
      isBallotComplete({ method: "plurality", numOptions: 3, voterName: "", choice: 0, ranking: null, approvals: [] }),
    ).toBe(false);
    expect(
      isBallotComplete({ method: "plurality", numOptions: 3, voterName: "   ", choice: 0, ranking: null, approvals: [] }),
    ).toBe(false);
  });

  it(`ニックネームが${MAX_VOTER_NAME_LENGTH}文字を超えるとfalse`, () => {
    expect(
      isBallotComplete({
        method: "plurality",
        numOptions: 3,
        voterName: "あ".repeat(MAX_VOTER_NAME_LENGTH + 1),
        choice: 0,
        ranking: null,
        approvals: [],
      }),
    ).toBe(false);
  });
});
