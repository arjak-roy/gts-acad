import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { resourceIdSchema } from "@/lib/validation-schemas/learning-resources";
import { listLearningResourceVersionsService } from "@/services/learning-resource-service";

type RouteContext = { params: { resourceId: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "learning_resources.view");
    const { resourceId } = resourceIdSchema.parse(params);
    const versions = await listLearningResourceVersionsService(resourceId);
    return apiSuccess(versions);
  } catch (error) {
    return apiError(error);
  }
}
