import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createCurriculumModuleSchema } from "@/lib/validation-schemas/curriculum";
import { createCurriculumModuleService } from "@/services/curriculum-service";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "curriculum.edit");
    const body = await request.json();
    const input = createCurriculumModuleSchema.parse(body);
    const moduleRecord = await createCurriculumModuleService(input, { actorUserId: session.userId });
    return apiSuccess(moduleRecord, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}