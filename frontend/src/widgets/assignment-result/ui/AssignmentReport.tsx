import type { AssignmentReportItem } from "../../../entities/assignment";
import { Badge } from "../../../shared/ui";

interface AssignmentReportProps {
  report: readonly AssignmentReportItem[];
}

const VARIANT_BY_STATUS = {
  ok: "ok",
  ng: "danger",
  info: "warning",
} as const;

const LABEL_BY_STATUS = {
  ok: "充足",
  ng: "違反",
  info: "注意",
} as const;

/**
 * 性質レポート。保証する性質の充足状況に加え、保証しない性質（耐戦略性）を
 * 注意項目として明示する。
 */
export function AssignmentReport({ report }: AssignmentReportProps) {
  return (
    <ul className="flex flex-col gap-3">
      {report.map((item) => {
        const status = item.status as keyof typeof VARIANT_BY_STATUS;
        return (
          <li key={item.label} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge variant={VARIANT_BY_STATUS[status] ?? "neutral"}>
                {LABEL_BY_STATUS[status] ?? item.status}
              </Badge>
              <span className="font-medium text-slate-800">{item.label}</span>
            </div>
            <p className="text-sm text-slate-600">{item.detail}</p>
          </li>
        );
      })}
    </ul>
  );
}
