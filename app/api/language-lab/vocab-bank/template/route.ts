import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/route-guards";
import {
  buildLanguageLabVocabTemplateCsv,
  LANGUAGE_LAB_VOCAB_IMPORT_TEMPLATE_FILE_NAME,
} from "@/lib/language-lab/vocab-bank";

export async function GET(request: NextRequest) {
  await requirePermission(request, "lms.view");

  return new Response(buildLanguageLabVocabTemplateCsv(), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${LANGUAGE_LAB_VOCAB_IMPORT_TEMPLATE_FILE_NAME}"`,
      "Cache-Control": "no-store",
    },
  });
}