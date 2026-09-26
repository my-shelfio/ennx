import type { AssignmentInput, AssignmentResult } from "../../../entities/assignment";

/**
 * 割り当て結果の JSON（全量）エクスポート。
 *
 * 入力・期待割当・抽選結果・くじ・性質レポートをそのまま含める。分数はサーバーが
 * 返した既約分数の文字列のままにして、再実行時に同じ値へ戻せるようにする。
 * 抽選シードを含めるのは、同じ入力とシードで誰でも同じ配属を再現できるようにするため。
 */
export interface AssignmentExportJson {
  exportedAt: string;
  input: AssignmentInput;
  result: AssignmentResult;
}

export function buildJsonExport(
  input: AssignmentInput,
  result: AssignmentResult,
): AssignmentExportJson {
  return {
    exportedAt: new Date().toISOString(),
    input,
    result,
  };
}
