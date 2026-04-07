import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { curriculumIdSchema, updateCurriculumSchema } from "@/lib/validation-schemas/curriculum";
import { deleteCurriculumService, getCurriculumByIdService, updateCurriculumService } from "@/services/curriculum-service";

type RouteContext = { params: { curriculumId: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "curriculum.view");
    const { curriculumId } = curriculumIdSchema.parse(params);
    const curriculum = await getCurriculumByIdService(curriculumId);
    if (!curriculum) {
      throw new Error("Curriculum not found.");
    }

    return apiSuccess(curriculum);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "curriculum.edit");
    const body = await request.json();
    const input = updateCurriculumSchema.parse({ ...body, curriculumId: params.curriculumId });
    const curriculum = await updateCurriculumService(input, { actorUserId: session.userId });
    return apiSuccess(curriculum);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "curriculum.delete");
    const { curriculumId } = curriculumIdSchema.parse(params);
    await deleteCurriculumService(curriculumId, { actorUserId: session.userId });
    return apiSuccess({ success: true });
  } catch (error) {
    return apiError(error);
  }
}