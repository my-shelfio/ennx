import { DEPARTMENT_COUNT_MAX } from "../../../entities/matching";

import type { ImportIssue } from "./types";

export interface ParsedSettingsCsv {
  departmentNames: string[];
  capacities: number[];
  issues: ImportIssue[];
}

/**
 * settings.csv（1行目ヘッダー、以降 `部署名,定員` の行）をパース・検証する。
 * 部署名の空欄・重複、定員の形式不正、部署数の上限超過はいずれも取込をブロックする
 * （部署の一意性・定員の妥当性は行列の構築そのものに必要な前提のため）。
 */
export function parseSettingsCsv(fileName: string, grid: readonly string[][]): ParsedSettingsCsv {
  const issues: ImportIssue[] = [];

  if (grid.length < 2) {
    issues.push({
      blocking: true,
      message: `${fileName}: ヘッダー行と1件以上のデータ行が必要です。`,
    });
    return { departmentNames: [], capacities: [], issues };
  }

  const dataRows = grid.slice(1);
  const departmentNames: string[] = [];
  const capacities: number[] = [];
  const seenNames = new Set<string>();

  dataRows.forEach((row, rowIndex) => {
    const lineNumber = rowIndex + 2;
    const name = (row[0] ?? "").trim();
    if (name === "") {
      issues.push({
        blocking: true,
        message: `${fileName} の${lineNumber}行目: 部署名が空欄です。`,
      });
      return;
    }
    if (seenNames.has(name)) {
      issues.push({
        blocking: true,
        message: `${fileName}: 部署名「${name}」が重複しています。`,
      });
      return;
    }
    seenNames.add(name);

    const capacityRaw = (row[1] ?? "").trim();
    const capacity = Number(capacityRaw);
    if (capacityRaw === "" || !Number.isInteger(capacity) || capacity < 0) {
      issues.push({
        blocking: true,
        message: `${fileName} の${lineNumber}行目「${name}」: 定員は0以上の整数で入力してください（現在の値: "${capacityRaw}"）。`,
      });
      return;
    }

    departmentNames.push(name);
    capacities.push(capacity);
  });

  if (departmentNames.length > DEPARTMENT_COUNT_MAX) {
    issues.push({
      blocking: true,
      message: `${fileName}: 部署数が上限（${DEPARTMENT_COUNT_MAX}）を超えています（${departmentNames.length}件）。`,
    });
  }

  return { departmentNames, capacities, issues };
}
