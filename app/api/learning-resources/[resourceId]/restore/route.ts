import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { resourceIdSchema, restoreLearningResourceVersionSchema } from "@/lib/validation-schemas/learning-resources";
import { restoreLearningResourceVersionService } from "@/services/learning-resource-service";

type RouteContext = { params: { resourceId: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "learning_resources.edit");
    const { resourceId } = resourceIdSchema.parse(params);
    const body = await request.json();
    const input = restoreLearningResourceVersionSchema.parse(body);
    const resource = await restoreLearningResourceVersionService(resourceId, input, { actorUserId: session.userId });
    return apiSuccess(resource);
  } catch (error) {
    return apiError(error);
  }
}
