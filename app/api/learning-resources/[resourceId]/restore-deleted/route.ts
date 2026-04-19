import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { resourceIdSchema } from "@/lib/validation-schemas/learning-resources";
import { restoreDeletedLearningResourceService } from "@/services/learning-resource-service";

type RouteContext = { params: { resourceId: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "learning_resources.delete");
    const { resourceId } = resourceIdSchema.parse(params);
    const resource = await restoreDeletedLearningResourceService(resourceId, { actorUserId: session.userId });
    return apiSuccess(resource);
  } catch (error) {
    return apiError(error);
  }
}
