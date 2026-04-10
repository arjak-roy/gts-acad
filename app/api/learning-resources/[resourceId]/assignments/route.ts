import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import {
  assignLearningResourceSchema,
  removeLearningResourceAssignmentSchema,
  resourceIdSchema,
} from "@/lib/validation-schemas/learning-resources";
import { assignLearningResourceService, getLearningResourceByIdService, removeLearningResourceAssignmentService } from "@/services/learning-resource-service";

type RouteContext = { params: { resourceId: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "learning_resources.view");
    const { resourceId } = resourceIdSchema.parse(params);
    const resource = await getLearningResourceByIdService(resourceId);
    if (!resource) {
      throw new Error("Learning resource not found.");
    }
    return apiSuccess(resource.assignments);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "learning_resources.assign");
    const { resourceId } = resourceIdSchema.parse(params);
    const body = await request.json();
    const input = assignLearningResourceSchema.parse(body);
    const assignments = await assignLearningResourceService(resourceId, input, { actorUserId: session.userId });
    return apiSuccess(assignments);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "learning_resources.assign");
    const { resourceId } = resourceIdSchema.parse(params);
    const body = await request.json();
    const input = removeLearningResourceAssignmentSchema.parse(body);
    await removeLearningResourceAssignmentService(resourceId, input.assignmentId, { actorUserId: session.userId });
    return apiSuccess({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
