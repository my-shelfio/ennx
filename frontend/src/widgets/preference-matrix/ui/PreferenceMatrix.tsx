import { useMemo, useState } from "react";

import type { RankCell, RankMatrix } from "../../../entities/matching";
import {
  isMatrixValid,
  matrixFromPrefs,
  prefsFromMatrix,
  resolveNames,
  updateRow,
  useMatchingInputStore,
  validateRow,
} from "../../../entities/matching";
import { Button } from "../../../shared/ui";

import { PreferencePulldownRow } from "./PreferencePulldownRow";

export interface PreferenceMatrixProps {
  /** 「マッチングを実行」押下時のハンドラ（実際の実行処理は features/run-matching で実装）。 */
  onSubmit: () => void;
  /** API 呼び出し中などで実行ボタンを一時的に無効化したい場合。 */
  isSubmitting?: boolean;
}

/**
 * 選好行列エディタ。
 *
 * 社員 → 部署（proposer_prefs）・部署 → 社員（receiver_prefs）の2つの行列を、
 * 向きタブ・入力方式タブ・行列の直接入力・ドラッグ&ドロップ並べ替えを廃止し、
 * プルダウン方式の単一画面として1画面に縦に並べて常時表示する。
 * 各行は PreferencePulldownRow で「第1希望」「第2希望」…を入力し、入力のたびに
 * useMatchingInputStore 経由で localStorage へ自動保存する。両行列の全行が有効になる
 * まで「マッチングを実行」ボタンは無効のまま。
 *
 * 行列（順位の重複・抜けをそのまま保持できる表現）は、この widget のローカル state を
 * 正本とする。選好リスト（1-indexed の相手番号を希望順に並べたもの、ストアの永続形式）は
 * 重複した順位を表現できないため、ストアの値を毎回行列へ変換し直すと、入力途中の
 * 重複・抜けの状態がレンダリングのたびに失われてしまう。そのためストアへは
 * 自動保存のためだけに書き込み、行列の読み出しは初回マウント時の値のみを使う。
 *
 * 検証エラーは行ごとのインライン表示のみとし、専用のサマリーパネル・ジャンプ導線は
 * 設けない。全行が常に画面上に並ぶ単一画面構成では一覧性がもともと高く、
 * 一覧から該当行へジャンプする導線の価値が小さいため、実装をシンプルに保つことを
 * 優先した。
 */
export function PreferenceMatrix({ onSubmit, isSubmitting = false }: PreferenceMatrixProps) {
  const setInput = useMatchingInputStore((state) => state.setInput);
  const [initialInput] = useState(() => useMatchingInputStore.getState().input);

  const [departmentCount] = useState(() => initialInput.capacities.length);
  const [employeeCount] = useState(() => initialInput.proposer_prefs.length);
  const [employeeNames] = useState(() =>
    resolveNames(initialInput.employee_names, employeeCount, "社員"),
  );
  const [departmentNames] = useState(() =>
    resolveNames(initialInput.department_names, departmentCount, "部署"),
  );

  const [proposerMatrix, setProposerMatrix] = useState<RankMatrix>(() =>
    matrixFromPrefs(initialInput.proposer_prefs, departmentCount),
  );
  const [receiverMatrix, setReceiverMatrix] = useState<RankMatrix>(() =>
    matrixFromPrefs(initialInput.receiver_prefs, employeeCount),
  );

  const proposerRowValidations = useMemo(
    () => proposerMatrix.map((row) => validateRow(row)),
    [proposerMatrix],
  );
  const receiverRowValidations = useMemo(
    () => receiverMatrix.map((row) => validateRow(row)),
    [receiverMatrix],
  );

  const canSubmit =
    employeeCount > 0 &&
    departmentCount > 0 &&
    isMatrixValid(proposerMatrix) &&
    isMatrixValid(receiverMatrix);

  function handleChangeProposerRow(rowIndex: number, nextRow: RankCell[]) {
    const next = updateRow(proposerMatrix, rowIndex, nextRow);
    setProposerMatrix(next);
    setInput({ proposer_prefs: prefsFromMatrix(next) });
  }

  function handleChangeReceiverRow(rowIndex: number, nextRow: RankCell[]) {
    const next = updateRow(receiverMatrix, rowIndex, nextRow);
    setReceiverMatrix(next);
    setInput({ receiver_prefs: prefsFromMatrix(next) });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          社員 → 部署
        </h2>
        <div className="flex flex-col gap-2">
          {employeeNames.map((employeeName, rowIndex) => (
            <PreferencePulldownRow
              key={rowIndex}
              rowLabel={employeeName}
              counterpartLabels={departmentNames}
              row={proposerMatrix[rowIndex] ?? []}
              validation={
                proposerRowValidations[rowIndex] ?? {
                  duplicateColumns: new Set<number>(),
                  isValid: false,
                }
              }
              onChangeRow={(nextRow) => handleChangeProposerRow(rowIndex, nextRow)}
              rowIdPrefix="proposer"
              rowIndex={rowIndex}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          部署 → 社員
        </h2>
        <div className="flex flex-col gap-2">
          {departmentNames.map((departmentName, rowIndex) => (
            <PreferencePulldownRow
              key={rowIndex}
              rowLabel={departmentName}
              counterpartLabels={employeeNames}
              row={receiverMatrix[rowIndex] ?? []}
              validation={
                receiverRowValidations[rowIndex] ?? {
                  duplicateColumns: new Set<number>(),
                  isValid: false,
                }
              }
              onChangeRow={(nextRow) => handleChangeReceiverRow(rowIndex, nextRow)}
              rowIdPrefix="receiver"
              rowIndex={rowIndex}
            />
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="button" disabled={!canSubmit || isSubmitting} onClick={onSubmit}>
          マッチングを実行
        </Button>
      </div>
    </div>
  );
}
