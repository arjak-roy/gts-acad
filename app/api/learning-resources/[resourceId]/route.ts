import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { resourceIdSchema, updateLearningResourceSchema } from "@/lib/validation-schemas/learning-resources";
import { deleteLearningResourceService, getLearningResourceByIdService, updateLearningResourceService } from "@/services/learning-resource-service";

type RouteContext = { params: { resourceId: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "learning_resources.view");
    const { resourceId } = resourceIdSchema.parse(params);
    const resource = await getLearningResourceByIdService(resourceId);
    if (!resource) {
      throw new Error("Learning resource not found.");
    }
    return apiSuccess(resource);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "learning_resources.edit");
    const body = await request.json();
    const input = updateLearningResourceSchema.parse({ ...body, resourceId: params.resourceId });
    const resource = await updateLearningResourceService(input, { actorUserId: session.userId });
    return apiSuccess(resource);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "learning_resources.delete");
    const { resourceId } = resourceIdSchema.parse(params);
    const resource = await deleteLearningResourceService(resourceId, { actorUserId: session.userId });
    return apiSuccess(resource);
  } catch (error) {
    return apiError(error);
  }
}
