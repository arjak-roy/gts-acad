import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { reorderCurriculumStagesSchema } from "@/lib/validation-schemas/curriculum";
import { reorderCurriculumStagesService } from "@/services/curriculum-service";

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "curriculum.edit");
    const body = await request.json();
    const input = reorderCurriculumStagesSchema.parse(body);
    await reorderCurriculumStagesService(input);
    return apiSuccess({ success: true });
  } catch (error) {
    return apiError(error);
  }
}