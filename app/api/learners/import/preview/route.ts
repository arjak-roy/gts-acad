import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { isCsvImportFileName, isCsvImportMimeTypeAllowed } from "@/lib/bulk-import/csv";
import { LEARNER_IMPORT_MAX_FILE_SIZE_BYTES } from "@/lib/imports/learners";
import { previewLearnerImportService } from "@/services/learners-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "users.create");
    const formData = await request.formData();
    const entry = formData.get("file");

    if (!(entry instanceof File) || entry.size === 0) {
      throw new Error("Select a CSV file to preview.");
    }

    if (!isCsvImportFileName(entry.name)) {
      throw new Error("Upload a .csv file.");
    }

    if (!isCsvImportMimeTypeAllowed(entry.type)) {
      throw new Error("Upload a CSV file with a supported content type.");
    }

    if (entry.size > LEARNER_IMPORT_MAX_FILE_SIZE_BYTES) {
      throw new Error("CSV file is too large for a synchronous preview.");
    }

    const preview = await previewLearnerImportService(
      {
        fileName: entry.name,
        csvText: await entry.text(),
      },
      { actorUserId: session.userId },
    );

    return apiSuccess(preview);
  } catch (error) {
    return apiError(error);
  }
}