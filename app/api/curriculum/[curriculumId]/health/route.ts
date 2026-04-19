import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { curriculumIdSchema } from "@/lib/validation-schemas/curriculum";
import { getCurriculumHealthReportService } from "@/services/curriculum-service";

type RouteContext = { params: { curriculumId: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "curriculum.view");
    const { curriculumId } = curriculumIdSchema.parse(params);
    const report = await getCurriculumHealthReportService(curriculumId);

    if (!report) {
      throw new Error("Curriculum not found.");
    }

    return apiSuccess(report);
  } catch (error) {
    return apiError(error);
  }
}
