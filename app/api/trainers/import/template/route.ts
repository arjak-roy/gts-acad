import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/route-guards";
import { buildTrainerImportTemplateCsv, TRAINER_IMPORT_TEMPLATE_FILE_NAME } from "@/lib/imports/trainers";

export async function GET(request: NextRequest) {
  await requirePermission(request, "trainers.view");

  return new Response(buildTrainerImportTemplateCsv(), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${TRAINER_IMPORT_TEMPLATE_FILE_NAME}"`,
      "Cache-Control": "no-store",
    },
  });
}