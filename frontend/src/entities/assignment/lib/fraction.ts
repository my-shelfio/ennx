/**
 * API が返す分数文字列（"1/2"・"0"・"71/96"）の解釈ユーティリティ。
 *
 * 期待割当とくじの重みは説明そのものなので、API は丸めていない厳密値を返す。
 * 画面では「厳密値をそのまま表示する」ことを基本とし、棒グラフの長さや並べ替えなど
 * 数値が必要な場面でのみ `fractionToNumber` で近似する。
 */

/** 分数文字列を数値に変換する（解釈できない場合は 0）。 */
export function fractionToNumber(value: string): number {
  const [numerator, denominator] = value.split("/");
  const top = Number(numerator);
  if (!Number.isFinite(top)) {
    return 0;
  }
  if (denominator === undefined) {
    return top;
  }
  const bottom = Number(denominator);
  if (!Number.isFinite(bottom) || bottom === 0) {
    return 0;
  }
  return top / bottom;
}

/** 分数文字列を百分率の文字列に変換する（例: "1/2" → "50.0%"）。 */
export function fractionToPercent(value: string, fractionDigits = 1): string {
  return `${(fractionToNumber(value) * 100).toFixed(fractionDigits)}%`;
}

/** 0 かどうか（"0" 以外の表現も数値で判定する）。 */
export function isZeroFraction(value: string): boolean {
  return fractionToNumber(value) === 0;
}
