import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createCurriculumStageItemSchema } from "@/lib/validation-schemas/curriculum";
import { createCurriculumStageItemService } from "@/services/curriculum-service";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "curriculum.edit");
    const body = await request.json();
    const input = createCurriculumStageItemSchema.parse(body);
    const item = await createCurriculumStageItemService(input, { actorUserId: session.userId });
    return apiSuccess(item, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}