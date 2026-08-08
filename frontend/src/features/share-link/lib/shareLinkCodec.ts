import type { ConstraintEntry, MatchingInput } from "../../../entities/matching";

import { base64UrlToBytes, bytesToBase64Url } from "./base64url";

/**
 * 共有リンクのペイロード形式。将来の `MatchingInput` スキーマ変更に耐えられるよう、
 * バージョンフィールド `v` を持たせる。
 * デコード側は `v` が既知のバージョンでない場合、安全に失敗（null を返す）とする。
 */
interface ShareLinkPayloadV1 {
  v: 1;
  input: MatchingInput;
}

const CURRENT_VERSION = 1;

/**
 * `?d=` の値として受け付ける最大文字数。`shareUrl.ts` の `MAX_SHARE_URL_LENGTH`（生成時の
 * しきい値）とは別に、デコード側でも早期に弾く（URL は利用者が自由に改変できるため、
 * このアプリが生成していない極端に長い値を渡された場合に備える）。
 */
const MAX_ENCODED_LENGTH = 20000;

/**
 * gzip 展開後のバイト数の上限。実運用の最大規模（部署50・社員100）でも展開後の JSON は
 * 数十KB程度に収まる想定のため、十分な余裕を見て 2MB とする。gzip は数百バイトの圧縮
 * データから数百MBへ展開できる（"圧縮爆弾"）ため、上限なしに展開するとリソース潻渴を
 * 招く。`decodeShareLinkData` は URL 経由の未検証入力に対して呼ばれるため必須のガード。
 */
const MAX_DECODED_BYTES = 2_000_000;

/**
 * `MatchingInput` を URL の `?d=` クエリパラメータに載せられる文字列へ圧縮エンコードする。
 * 追加ライブラリを導入せず、標準の `CompressionStream`（gzip）+ Base64URL で実装する
 * （本番実行時依存を増やさない方針。モダンブラウザ（Chrome 80+ / Firefox 113+ / Safari 16.4+）で
 * 利用可能）。
 */
export async function encodeShareLinkData(input: MatchingInput): Promise<string> {
  const payload: ShareLinkPayloadV1 = { v: CURRENT_VERSION, input };
  const json = JSON.stringify(payload);
  const compressed = await gzipCompress(json);
  return bytesToBase64Url(compressed);
}

/**
 * 共有リンクの `?d=` の値を `MatchingInput` へ復元する。
 * 展開・パース・形状検証のいずれかに失敗した場合は、例外を投げず null を返す
 * （URL は利用者が自由に改変・共有できるため、不正な値でアプリをクラッシュさせない）。
 */
export async function decodeShareLinkData(encoded: string): Promise<MatchingInput | null> {
  if (encoded.length === 0 || encoded.length > MAX_ENCODED_LENGTH) {
    return null;
  }

  let json: string;
  try {
    const bytes = base64UrlToBytes(encoded);
    json = await gzipDecompress(bytes);
  } catch {
    return null;
  }
  if (json === "") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (!isShareLinkPayloadV1(parsed)) {
    return null;
  }
  return parsed.input;
}

async function gzipCompress(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function gzipDecompress(bytes: Uint8Array): Promise<string> {
  // bytes は base64UrlToBytes / gzipCompress の戻り値のみを想定しており、常に通常の
  // ArrayBuffer（SharedArrayBuffer ではない）に裏付けられる。BlobPart の型（TS 5.7+ の
  // ArrayBufferView<ArrayBuffer> 制約）を満たすためのアサーション。
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));

  // gzip は数百バイトの入力から数百MBへ展開できるため（圧縮爆弾）、Response.text() で
  // 一括展開せず、chunk 単位で読み進めながら累積サイズが MAX_DECODED_BYTES を超えた
  // 時点で中断する。
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > MAX_DECODED_BYTES) {
        await reader.cancel();
        throw new Error("decoded payload exceeds MAX_DECODED_BYTES");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

function isShareLinkPayloadV1(value: unknown): value is ShareLinkPayloadV1 {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.v === CURRENT_VERSION && isMatchingInputShape(record.input);
}

/**
 * `MatchingInput` として最低限扱える形かどうかを検証する（実行時の型ガード）。
 * サーバーの完全な検証（`POST /api/v1/matching/validate`）の代替ではなく、共有リンク経由の
 * 入力でフロントエンドの以降の処理（選好行列の描画等）がクラッシュしない形状であることを
 * 保証するのが目的。
 */
function isMatchingInputShape(value: unknown): value is MatchingInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;

  if (typeof record.constraint_type !== "string") {
    return false;
  }
  if (!isNumberArray(record.capacities)) {
    return false;
  }
  if (!isNumberArrayArray(record.proposer_prefs)) {
    return false;
  }
  if (!isNumberArrayArray(record.receiver_prefs)) {
    return false;
  }
  if (!isNullableStringArray(record.employee_names)) {
    return false;
  }
  if (!isNullableStringArray(record.department_names)) {
    return false;
  }
  if (!isNullableNumberArray(record.max_caps)) {
    return false;
  }
  if (!isNullableNumberArray(record.regions)) {
    return false;
  }
  if (!isNullableNumberArray(record.regional_caps)) {
    return false;
  }
  if (!isNullableConstraintArray(record.constraints)) {
    return false;
  }
  return true;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function isNumberArrayArray(value: unknown): value is number[][] {
  return Array.isArray(value) && value.every((item) => isNumberArray(item));
}

function isNullableNumberArray(value: unknown): value is number[] | null | undefined {
  return value === undefined || value === null || isNumberArray(value);
}

function isNullableStringArray(value: unknown): value is string[] | null | undefined {
  return (
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

function isNullableConstraintArray(
  value: unknown,
): value is ConstraintEntry[] | null | undefined {
  if (value === undefined || value === null) {
    return true;
  }
  return Array.isArray(value) && value.every((item) => isConstraintEntryShape(item));
}

function isConstraintEntryShape(value: unknown): value is ConstraintEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).type === "string"
  );
}
