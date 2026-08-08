/**
 * URL セーフな Base64（RFC 4648 §5、パディングなし）へのエンコード／デコード。
 * バイナリ（gzip 圧縮後のバイト列）を `?d=` クエリパラメータへ安全に載せるために使う。
 * 追加ライブラリを導入せず標準の `btoa`/`atob` を利用する（本番実行時依存を増やさない方針）。
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * `bytesToBase64Url` の逆変換。不正な文字列を渡された場合は例外を投げうるため、
 * 呼び出し側（shareLinkCodec.ts）で try/catch すること。
 */
export function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
