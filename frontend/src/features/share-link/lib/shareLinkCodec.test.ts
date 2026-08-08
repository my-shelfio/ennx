import { expect, test } from "vitest";

import type { MatchingInput } from "../../../entities/matching";

import { base64UrlToBytes, bytesToBase64Url } from "./base64url";
import { decodeShareLinkData, encodeShareLinkData } from "./shareLinkCodec";

const sampleInput: MatchingInput = {
  constraint_type: "capacity_only",
  capacities: [2, 1],
  proposer_prefs: [
    [1, 2],
    [2, 1],
    [1],
  ],
  receiver_prefs: [
    [1, 2, 3],
    [3, 2, 1],
  ],
  employee_names: ["社員A", "社員B", "社員C"],
  department_names: ["部署A", "部署B"],
};

/** JSON ペイロードをテスト用に圧縮エンコードする（本体の gzip 実装をそのまま使う）。 */
async function encodePayload(payload: unknown): Promise<string> {
  const json = JSON.stringify(payload);
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return bytesToBase64Url(new Uint8Array(buffer));
}

test("エンコード→デコードで元の入力を復元できる", async () => {
  const encoded = await encodeShareLinkData(sampleInput);
  await expect(decodeShareLinkData(encoded)).resolves.toEqual(sampleInput);
});

test("employee_names/department_names 省略時（null）も復元できる", async () => {
  const input: MatchingInput = {
    constraint_type: "capacity_only",
    capacities: [1],
    proposer_prefs: [[1]],
    receiver_prefs: [[1]],
  };
  const encoded = await encodeShareLinkData(input);
  await expect(decodeShareLinkData(encoded)).resolves.toEqual(input);
});

test("空文字はデコード失敗として null を返す", async () => {
  await expect(decodeShareLinkData("")).resolves.toBeNull();
});

test("Base64URLとして不正な文字列はデコード失敗として null を返す", async () => {
  await expect(decodeShareLinkData("!!!not-valid-base64!!!")).resolves.toBeNull();
});

test("gzipとして展開できないバイト列はデコード失敗として null を返す", async () => {
  const garbage = bytesToBase64Url(new Uint8Array([1, 2, 3, 4, 5]));
  await expect(decodeShareLinkData(garbage)).resolves.toBeNull();
});

test("バージョンが未知の場合は null を返す（将来のスキーマ変更に備えた安全側フォールバック）", async () => {
  await expect(decodeShareLinkData(await encodeShareLinkData(sampleInput))).resolves.not.toBeNull();

  const tampered = await encodePayload({ v: 2, input: sampleInput });
  await expect(decodeShareLinkData(tampered)).resolves.toBeNull();
});

test("構造が壊れている（proposer_prefs が文字列配列）場合は null を返す", async () => {
  const malformed = await encodePayload({
    v: 1,
    input: { ...sampleInput, proposer_prefs: [["a", "b"]] },
  });
  await expect(decodeShareLinkData(malformed)).resolves.toBeNull();
});

test("input.constraint_type が欠けている場合は null を返す", async () => {
  const rest: Record<string, unknown> = { ...sampleInput };
  delete rest.constraint_type;
  const malformed = await encodePayload({ v: 1, input: rest });
  await expect(decodeShareLinkData(malformed)).resolves.toBeNull();
});

test("bytesToBase64Url / base64UrlToBytes は互いに逆変換になる", () => {
  const original = new Uint8Array([0, 1, 2, 253, 254, 255, 127, 128]);
  expect(base64UrlToBytes(bytesToBase64Url(original))).toEqual(original);
});

test("bytesToBase64Url の出力は URL セーフな文字のみで構成される（+ / = を含まない）", () => {
  const bytes = new Uint8Array(64).map((_, i) => i * 4);
  const encoded = bytesToBase64Url(bytes);
  expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
});

test("極端に長いエンコード文字列は展開を試みず null を返す（想定していない入力の早期拒否）", async () => {
  const tooLong = "A".repeat(20001);
  await expect(decodeShareLinkData(tooLong)).resolves.toBeNull();
});

test("gzip展開爆弾（小さい圧縮データが巨大に展開される）は途中で中断され null を返す", async () => {
  // 高圧縮率の巨大なJSON（同一文字の繰り返し）を圧縮すると、圧縮後は非常に小さくなる。
  // MAX_DECODED_BYTES（2MB）を大きく超える展開結果になるデータを用意する。
  const hugeJson = JSON.stringify({ v: 1, input: { padding: "A".repeat(10_000_000) } });
  const stream = new Blob([hugeJson]).stream().pipeThrough(new CompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  const bomb = bytesToBase64Url(new Uint8Array(buffer));

  // 圧縮後も MAX_ENCODED_LENGTH 以下であること（=長さチェックではなく展開量チェックで
  // 拒否されることを確認するための前提）。
  expect(bomb.length).toBeLessThan(20000);

  await expect(decodeShareLinkData(bomb)).resolves.toBeNull();
});
