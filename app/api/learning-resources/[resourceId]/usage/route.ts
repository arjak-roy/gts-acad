import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { recordLearningResourceUsageSchema, resourceIdSchema } from "@/lib/validation-schemas/learning-resources";
import { recordLearningResourceUsageService } from "@/services/learning-resource-service";

type RouteContext = { params: { resourceId: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "learning_resources.view");
    const { resourceId } = resourceIdSchema.parse(params);
    const body = await request.json();
    const input = recordLearningResourceUsageSchema.parse(body);
    const usage = await recordLearningResourceUsageService(resourceId, input, { actorUserId: session.userId });
    return apiSuccess(usage, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
