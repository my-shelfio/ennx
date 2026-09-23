import { useMemo } from "react";

import type { DepartmentApplicant, MatchingResult } from "../../../entities/matching";
import { buildDepartmentBreakdown, describeRejectionCause } from "../../../entities/matching";
import { Badge, Dialog } from "../../../shared/ui";

export interface DepartmentDetailProps {
  result: MatchingResult;
  /** 実行に使った選好リスト（社員→部署、1-indexed）。 */
  proposerPrefs: readonly (readonly number[])[];
  /** 実行に使った選好リスト（部署→社員、1-indexed）。 */
  receiverPrefs: readonly (readonly number[])[];
  /** 表示する部署（0-indexed）。null のときは閉じた状態。 */
  department: number | null;
  onClose: () => void;
}

function priorityLabel(applicant: DepartmentApplicant): string {
  return applicant.priorityRank === null ? "順位外" : `部署内 ${applicant.priorityRank} 位`;
}

function ApplicantList({
  title,
  applicants,
  employeeNames,
  emptyText,
  renderDetail,
}: {
  title: string;
  applicants: readonly DepartmentApplicant[];
  employeeNames: readonly string[];
  emptyText: string;
  renderDetail: (applicant: DepartmentApplicant) => string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-slate-900">
        {title}（{applicants.length}名）
      </h3>
      {applicants.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {applicants.map((applicant) => (
            <li
              key={applicant.employee}
              className="flex flex-col gap-1 rounded-control border border-slate-200 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-900">
                  {employeeNames[applicant.employee] ?? `社員${applicant.employee + 1}`}
                </span>
                <Badge>{priorityLabel(applicant)}</Badge>
                <Badge variant="primary">本人の第{applicant.preferenceRank}希望</Badge>
              </div>
              <p className="text-slate-600">{renderDetail(applicant)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * 部署詳細ビュー（部署ごとの受入・棄却の内訳）。
 * 部署を希望した社員を「受け入れた」「受け入れなかった（理由つき）」「より上位の希望に配属」に
 * 分け、部署側の優先順位順に並べる。カットオフ調整（CA）ではカットオフを
 * 「部署の優先順位で上位 N 位まで」に読み替えて表示する。
 */
export function DepartmentDetail({
  result,
  proposerPrefs,
  receiverPrefs,
  department,
  onClose,
}: DepartmentDetailProps) {
  const breakdown = useMemo(
    () =>
      department === null
        ? null
        : buildDepartmentBreakdown(result, proposerPrefs, receiverPrefs, department),
    [result, proposerPrefs, receiverPrefs, department],
  );

  const departmentName =
    department === null ? "" : (result.department_names[department] ?? `部署${department + 1}`);
  const capacity = department === null ? 0 : (result.capacities[department] ?? 0);
  const applicants = breakdown?.applicants ?? [];
  const accepted = applicants.filter((applicant) => applicant.status === "accepted");
  const rejected = applicants.filter((applicant) => applicant.status === "rejected");
  const placedHigher = applicants.filter((applicant) => applicant.status === "placedHigher");

  return (
    <Dialog
      open={breakdown !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={`${departmentName}の受入・棄却の内訳`}
      description={`定員 ${capacity} 名・受入 ${accepted.length} 名・希望者 ${applicants.length} 名。社員は部署側の優先順位順に並びます。`}
    >
      <div className="flex flex-col gap-6">
        {breakdown?.cutoff != null && (
          <div className="rounded-control border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-700">
            <p className="font-semibold">
              カットオフ: {departmentName}の優先順位で
              {breakdown.cutoff.passRankLimit > 0
                ? `上位 ${breakdown.cutoff.passRankLimit} 位まで`
                : "受け入れ対象なし"}
            </p>
            <p className="mt-1 text-xs">
              {breakdown.cutoff.value > 1
                ? `定員・NG ペア等の制約を満たすまでカットオフを引き上げた結果です（内部値 ${breakdown.cutoff.value}）。`
                : "カットオフは引き上げられておらず、優先順位リストの全員が受け入れ対象です（内部値 1）。"}
              この順位までの社員のうち、足切りを通過した部署の中で{departmentName}を最も希望する社員が受け入れられます。
            </p>
          </div>
        )}

        <ApplicantList
          title="受け入れた社員"
          applicants={accepted}
          employeeNames={result.employee_names}
          emptyText="受け入れた社員はいません。"
          renderDetail={() => `${departmentName}に配属されました。`}
        />
        <ApplicantList
          title="希望したが受け入れなかった社員"
          applicants={rejected}
          employeeNames={result.employee_names}
          emptyText="希望した社員はすべて受け入れたか、より上位の希望に配属されています。"
          renderDetail={(applicant) => {
            const reason =
              applicant.cause === null
                ? "受け入れられなかった"
                : describeRejectionCause(applicant.cause);
            const assigned = result.proposer_match[applicant.employee] ?? -1;
            const destination =
              assigned === -1
                ? "未配属"
                : `${result.department_names[assigned] ?? `部署${assigned + 1}`}に配属`;
            return `${reason}。（結果: ${destination}）`;
          }}
        />
        {placedHigher.length > 0 && (
          <ApplicantList
            title="より上位の希望に配属された社員"
            applicants={placedHigher}
            employeeNames={result.employee_names}
            emptyText=""
            renderDetail={(applicant) => {
              const assigned = result.proposer_match[applicant.employee] ?? -1;
              const name = result.department_names[assigned] ?? `部署${assigned + 1}`;
              return `本人が${departmentName}より希望する${name}に配属されました。`;
            }}
          />
        )}
      </div>
    </Dialog>
  );
}
