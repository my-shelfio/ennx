import { downloadFile } from "../../../shared/lib";
import { Button } from "../../../shared/ui";
import {
  buildTemplateDepartmentPrefsCsv,
  buildTemplateEmployeePrefsCsv,
  buildTemplateSettingsCsv,
} from "../lib/buildTemplateCsv";
import { IMPORT_FILE_NAMES } from "../lib/types";
import type { ImportFileRole } from "../lib/types";

export interface TemplateDownloadLinksProps {
  /** ダウンロード可能にするテンプレートの役割一覧（画面の取込モードに合わせる）。 */
  roles: readonly ImportFileRole[];
}

const TEMPLATE_BUILDERS: Record<ImportFileRole, () => string> = {
  settings: buildTemplateSettingsCsv,
  employee_prefs: buildTemplateEmployeePrefsCsv,
  department_prefs: buildTemplateDepartmentPrefsCsv,
};

/** 記入用テンプレートCSV（記入例入り）のダウンロードボタン一式。 */
export function TemplateDownloadLinks({ roles }: TemplateDownloadLinksProps) {
  function handleDownload(role: ImportFileRole) {
    const fileName = IMPORT_FILE_NAMES[role];
    downloadFile(fileName, TEMPLATE_BUILDERS[role](), "text/csv");
  }

  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((role) => (
        <Button
          key={role}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleDownload(role)}
        >
          {IMPORT_FILE_NAMES[role]} をダウンロード
        </Button>
      ))}
    </div>
  );
}
