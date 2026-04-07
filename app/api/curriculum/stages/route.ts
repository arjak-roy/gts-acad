import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createCurriculumStageSchema } from "@/lib/validation-schemas/curriculum";
import { createCurriculumStageService } from "@/services/curriculum-service";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "curriculum.edit");
    const body = await request.json();
    const input = createCurriculumStageSchema.parse(body);
    const stage = await createCurriculumStageService(input, { actorUserId: session.userId });
    return apiSuccess(stage, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}