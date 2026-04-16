import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/route-guards";
import { buildLearnerImportTemplateCsv, LEARNER_IMPORT_TEMPLATE_FILE_NAME } from "@/lib/imports/learners";

export async function GET(request: NextRequest) {
  await requirePermission(request, "users.view");

  return new Response(buildLearnerImportTemplateCsv(), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${LEARNER_IMPORT_TEMPLATE_FILE_NAME}"`,
      "Cache-Control": "no-store",
    },
  });
}