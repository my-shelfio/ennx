import { useEffect, useMemo, useState } from "react";

import type {
  RankCell,
  RankMatrix,
  ReceiverPrefsMode,
  ReceiverPrefsSettings,
} from "../../../entities/matching";
import {
  applyCommonRow,
  copyRow,
  fillRemainingAll,
  isMatrixValid,
  isRowComplete,
  isRowEmpty,
  matrixFromPrefs,
  normalizeReceiverPrefsSettings,
  overridesOnEnterCommonMode,
  prefsFromMatrix,
  randomizeMatrix,
  resolveNames,
  updateRow,
  useMatchingInputStore,
  validateRow,
} from "../../../entities/matching";
import { Button } from "../../../shared/ui";

import { MatrixToolbar } from "./MatrixToolbar";
import { PreferencePulldownRow } from "./PreferencePulldownRow";
import { ReceiverModeSwitch } from "./ReceiverModeSwitch";

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
 *
 * 手入力の負荷を下げるため、行列ごとに一括操作のツールバー（残りを自動補完・
 * ランダム生成）を、各行に「残りを自動補完」「行をコピー」を置く。一括操作も
 * 1 行の編集と同じく、ローカルの行列を更新してからストアへ自動保存する。
 *
 * 部署 → 社員は「全部署で共通の評価順位を使う」モードを選べる。このモードでは共通の順位を
 * 1 行だけ入力し、「この部署だけ個別に設定」にしていない全部署の行へ展開する。
 * ローカルの行列（receiverMatrix）とストアの receiver_prefs は常に展開済みの値を持つため、
 * 実行・共有リンク・エクスポートは入力方式を意識せずに従来どおり動作する。
 * 共通モードから部署ごとモードへ戻すと、展開済みの行列がそのまま部署ごとの初期値になる。
 * 部署ごとモードから共通モードへ切り替えるときは、入力済みで共通順位と異なる部署を
 * 個別設定として残し、切り替えで入力が失われないようにする。
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
  const [initialReceiverSettings] = useState<ReceiverPrefsSettings>(() =>
    normalizeReceiverPrefsSettings(
      useMatchingInputStore.getState().receiverPrefsSettings,
      employeeCount,
      departmentCount,
    ),
  );
  const [receiverMode, setReceiverMode] = useState<ReceiverPrefsMode>(
    initialReceiverSettings.mode,
  );
  const [commonRow, setCommonRow] = useState<RankCell[]>(
    () => [...(matrixFromPrefs([initialReceiverSettings.commonPrefs], employeeCount)[0] ?? [])],
  );
  const [receiverOverrides, setReceiverOverrides] = useState<boolean[]>(
    initialReceiverSettings.overrides,
  );
  const [receiverMatrix, setReceiverMatrix] = useState<RankMatrix>(() => {
    const matrix = matrixFromPrefs(initialInput.receiver_prefs, employeeCount);
    return initialReceiverSettings.mode === "common"
      ? applyCommonRow(matrix, commonRow, initialReceiverSettings.overrides)
      : matrix;
  });

  // 規模の変更などで保存済みの共通順位・行列を正規化した場合に、ストアへ書き戻す
  // （展開済みの receiver_prefs を常にストアの正本にするため、初回表示時に 1 度だけ行う）。
  const setReceiverPrefsSettings = useMatchingInputStore(
    (state) => state.setReceiverPrefsSettings,
  );
  useEffect(() => {
    setReceiverPrefsSettings(initialReceiverSettings);
    if (initialReceiverSettings.mode === "common") {
      setInput({ receiver_prefs: prefsFromMatrix(receiverMatrix) });
    }
    // 初回表示時の値のみを書き戻す。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function applyProposerMatrix(next: RankMatrix) {
    setProposerMatrix(next);
    setInput({ proposer_prefs: prefsFromMatrix(next) });
  }

  function applyReceiverMatrix(next: RankMatrix) {
    setReceiverMatrix(next);
    setInput({ receiver_prefs: prefsFromMatrix(next) });
  }

  function handleChangeProposerRow(rowIndex: number, nextRow: RankCell[]) {
    applyProposerMatrix(updateRow(proposerMatrix, rowIndex, nextRow));
  }

  function handleChangeReceiverRow(rowIndex: number, nextRow: RankCell[]) {
    applyReceiverMatrix(updateRow(receiverMatrix, rowIndex, nextRow));
  }

  function saveReceiverSettings(
    mode: ReceiverPrefsMode,
    nextCommonRow: readonly RankCell[],
    overrides: boolean[],
  ) {
    setReceiverMode(mode);
    setCommonRow([...nextCommonRow]);
    setReceiverOverrides(overrides);
    setReceiverPrefsSettings({
      mode,
      commonPrefs: prefsFromMatrix([nextCommonRow])[0] ?? [],
      overrides,
    });
  }

  function handleChangeReceiverMode(mode: ReceiverPrefsMode) {
    if (mode === receiverMode) {
      return;
    }
    if (mode === "per_department") {
      // 展開済みの行列をそのまま部署ごとの初期値にする（個別設定の有無は次回のために保持）。
      saveReceiverSettings(mode, commonRow, receiverOverrides);
      return;
    }
    const overrides = overridesOnEnterCommonMode(receiverMatrix, commonRow, receiverOverrides);
    saveReceiverSettings(mode, commonRow, overrides);
    applyReceiverMatrix(applyCommonRow(receiverMatrix, commonRow, overrides));
  }

  function handleChangeCommonRow(nextRow: RankCell[]) {
    saveReceiverSettings(receiverMode, nextRow, receiverOverrides);
    applyReceiverMatrix(applyCommonRow(receiverMatrix, nextRow, receiverOverrides));
  }

  function handleToggleOverride(department: number, isOverridden: boolean) {
    const overrides = receiverOverrides.map((value, index) =>
      index === department ? isOverridden : value,
    );
    saveReceiverSettings(receiverMode, commonRow, overrides);
    // 個別設定をやめた部署は共通順位へ戻す（個別設定を始めた部署は共通順位を初期値として残る）。
    applyReceiverMatrix(applyCommonRow(receiverMatrix, commonRow, overrides));
  }

  const commonRowValidation = useMemo(() => validateRow(commonRow), [commonRow]);

  function renderReceiverRow(departmentName: string, rowIndex: number) {
    return (
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
        copySourceLabels={departmentNames}
        onCopyFrom={(sourceRowIndex) =>
          applyReceiverMatrix(copyRow(receiverMatrix, sourceRowIndex, rowIndex))
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          社員 → 部署
        </h2>
        <MatrixToolbar
          matrixLabel="社員 → 部署"
          hasEmptyRow={proposerMatrix.some(isRowEmpty)}
          hasIncompleteRow={!proposerMatrix.every(isRowComplete)}
          onFillAll={() => applyProposerMatrix(fillRemainingAll(proposerMatrix))}
          onRandomizeEmpty={() =>
            applyProposerMatrix(randomizeMatrix(proposerMatrix, Math.random, "empty"))
          }
          onRandomizeAll={() =>
            applyProposerMatrix(randomizeMatrix(proposerMatrix, Math.random, "all"))
          }
        />
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
              copySourceLabels={employeeNames}
              onCopyFrom={(sourceRowIndex) =>
                applyProposerMatrix(copyRow(proposerMatrix, sourceRowIndex, rowIndex))
              }
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          部署 → 社員
        </h2>
        <ReceiverModeSwitch mode={receiverMode} onChange={handleChangeReceiverMode} />
        {receiverMode === "per_department" ? (
          <>
            <MatrixToolbar
              matrixLabel="部署 → 社員"
              hasEmptyRow={receiverMatrix.some(isRowEmpty)}
              hasIncompleteRow={!receiverMatrix.every(isRowComplete)}
              onFillAll={() => applyReceiverMatrix(fillRemainingAll(receiverMatrix))}
              onRandomizeEmpty={() =>
                applyReceiverMatrix(randomizeMatrix(receiverMatrix, Math.random, "empty"))
              }
              onRandomizeAll={() =>
                applyReceiverMatrix(randomizeMatrix(receiverMatrix, Math.random, "all"))
              }
            />
            <div className="flex flex-col gap-2">
              {departmentNames.map((departmentName, rowIndex) =>
                renderReceiverRow(departmentName, rowIndex),
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <PreferencePulldownRow
              rowLabel="全部署共通の評価順位"
              counterpartLabels={employeeNames}
              row={commonRow}
              validation={commonRowValidation}
              onChangeRow={handleChangeCommonRow}
              rowIdPrefix="receiver-common"
              rowIndex={0}
            />
            <p className="text-xs text-slate-500">
              この順位が、個別に設定していない全部署の順位になります。
            </p>
            <ul className="flex flex-col gap-2">
              {departmentNames.map((departmentName, rowIndex) => {
                const isOverridden = receiverOverrides[rowIndex] === true;
                const checkboxId = `receiver-override-${rowIndex}`;
                return (
                  <li key={rowIndex} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-slate-200 bg-white px-4 py-1">
                      <span className="text-sm font-medium text-slate-900">
                        {departmentName}
                        {isOverridden ? null : (
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            共通の評価順位を使用
                          </span>
                        )}
                      </span>
                      <label
                        htmlFor={checkboxId}
                        className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700"
                      >
                        <input
                          id={checkboxId}
                          type="checkbox"
                          checked={isOverridden}
                          onChange={(event) => handleToggleOverride(rowIndex, event.target.checked)}
                          className="h-4 w-4 accent-primary-600"
                        />
                        この部署だけ個別に設定
                      </label>
                    </div>
                    {isOverridden ? renderReceiverRow(departmentName, rowIndex) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button type="button" disabled={!canSubmit || isSubmitting} onClick={onSubmit}>
          マッチングを実行
        </Button>
      </div>
    </div>
  );
}
