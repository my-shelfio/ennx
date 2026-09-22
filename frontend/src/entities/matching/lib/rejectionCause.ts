/**
 * 棄却理由の分類と平易な言い換え。
 *
 * サーバーのイベントログは棄却理由を自由文（例: 「設置上限（3人）超過」）で返すため、
 * 既知の文言パターンを構造化した理由に変換し、社員・部署視点の説明文に言い換える。
 * 未知の文言は原文のまま保持し、表示時もそのまま示す（サーバー側で文言が増えても
 * 説明が欠落しないようにするため）。
 */
export type RejectionCause =
  /** 定員が、部署側の評価がより高い社員で埋まっていた（新規の希望が溢れた）。 */
  | { kind: "capacity" }
  /** いったん仮受入されたが、評価がより高い社員の希望により定員から押し出された。 */
  | { kind: "displaced" }
  /** 部署側の優先順位リストに含まれていない（受け入れ不可能）。 */
  | { kind: "unacceptable" }
  /** 部署の設置上限に達していた（FDA）。 */
  | { kind: "maxCap"; limit: number }
  /** 部署が属する地域の受け入れ上限に達していた（FDA）。 */
  | { kind: "regionalCap"; limit: number }
  /** 追加制約（定員・NG ペア等）を満たすためカットオフが引き上げられ、対象から外れた（CA）。 */
  | { kind: "cutoff"; from: number; to: number }
  /** 既知のパターンに当てはまらない理由（原文）。 */
  | { kind: "unknown"; text: string };

const MAX_CAP_PATTERN = /^設置上限（(\d+)人）超過/;
const REGIONAL_CAP_PATTERN = /^地域上限（(\d+)人）超過/;
const CUTOFF_RAISE_PATTERN = /カットオフを (\d+) → (\d+) に引き上げ/;

/**
 * reject イベントの理由文を分類する。
 * 「待機リストへ差し戻し」は棄却ではなく待機への移動なので、この関数の対象外
 * （{@link isReturnToWaitlist} で先に判定する）。
 */
export function classifyRejectReason(reason: string | null | undefined): RejectionCause {
  const text = reason ?? "";
  if (text === "受け入れ不可能") {
    return { kind: "unacceptable" };
  }
  if (text.startsWith("定員超過（優先順位の高い提案者に押し出し）")) {
    return { kind: "displaced" };
  }
  if (text === "定員超過") {
    return { kind: "capacity" };
  }
  const maxCap = MAX_CAP_PATTERN.exec(text);
  if (maxCap?.[1] !== undefined) {
    return { kind: "maxCap", limit: Number(maxCap[1]) };
  }
  const regionalCap = REGIONAL_CAP_PATTERN.exec(text);
  if (regionalCap?.[1] !== undefined) {
    return { kind: "regionalCap", limit: Number(regionalCap[1]) };
  }
  return { kind: "unknown", text };
}

/** reject イベントが「目標定員超過による待機リストへの差し戻し」（棄却ではない）かどうか。 */
export function isReturnToWaitlist(reason: string | null | undefined): boolean {
  return (reason ?? "").includes("差し戻し");
}

/**
 * cutoff_raise イベントの理由文から引き上げ前後のカットオフ値を取り出す。
 * 形式が想定外の場合は null。
 */
export function parseCutoffRaise(
  reason: string | null | undefined,
): { from: number; to: number } | null {
  const match = CUTOFF_RAISE_PATTERN.exec(reason ?? "");
  if (match?.[1] === undefined || match[2] === undefined) {
    return null;
  }
  return { from: Number(match[1]), to: Number(match[2]) };
}

/**
 * 棄却理由を「部署に受け入れられなかった理由」として平易な日本語に言い換える。
 * 文末の句点は付けない（呼び出し側で文を組み立てるため）。
 *
 * @param departmentName 文中に部署名を含める場合の部署名。主語で部署名を示している文
 *   （例: 「第1希望の営業部は、〜ため」）では省略し、部署名の繰り返しを避ける。
 */
export function describeRejectionCause(cause: RejectionCause, departmentName?: string): string {
  const of = departmentName === undefined ? "" : `${departmentName}の`;
  switch (cause.kind) {
    case "capacity":
      return `${of}定員が、評価がより高い社員で埋まっていた`;
    case "displaced":
      return `いったん仮受入されたが、評価がより高い社員が後から希望し、${of}定員から押し出された`;
    case "unacceptable":
      return `${of}受け入れ候補（優先順位リスト）に含まれていなかった`;
    case "maxCap":
      return `${of}設置上限（${cause.limit}人）に達していた`;
    case "regionalCap":
      return `${departmentName === undefined ? "所属する" : `${departmentName}のある`}地域の受け入れ上限（${cause.limit}人）に達していた`;
    case "cutoff":
      return `${of}制約（定員・NG ペア等）を満たすためにカットオフが引き上げられ（${cause.from} → ${cause.to}）、受け入れ対象から外れた`;
    case "unknown":
      return cause.text === "" ? "受け入れられなかった" : cause.text;
  }
}

/** 棄却理由の短い見出し（一覧・バッジ向け）。 */
export function rejectionCauseLabel(cause: RejectionCause): string {
  switch (cause.kind) {
    case "capacity":
      return "定員超過";
    case "displaced":
      return "定員超過（押し出し）";
    case "unacceptable":
      return "受け入れ候補外";
    case "maxCap":
      return "設置上限";
    case "regionalCap":
      return "地域上限";
    case "cutoff":
      return "カットオフ未達";
    case "unknown":
      return cause.text === "" ? "不明" : cause.text;
  }
}
