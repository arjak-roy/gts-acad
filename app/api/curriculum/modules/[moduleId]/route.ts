import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { moduleIdSchema, updateCurriculumModuleSchema } from "@/lib/validation-schemas/curriculum";
import { deleteCurriculumModuleService, updateCurriculumModuleService } from "@/services/curriculum-service";

type RouteContext = { params: { moduleId: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "curriculum.edit");
    const body = await request.json();
    const input = updateCurriculumModuleSchema.parse({ ...body, moduleId: params.moduleId });
    const moduleRecord = await updateCurriculumModuleService(input, { actorUserId: session.userId });
    return apiSuccess(moduleRecord);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "curriculum.edit");
    const { moduleId } = moduleIdSchema.parse(params);
    await deleteCurriculumModuleService(moduleId, { actorUserId: session.userId });
    return apiSuccess({ success: true });
  } catch (error) {
    return apiError(error);
  }
}