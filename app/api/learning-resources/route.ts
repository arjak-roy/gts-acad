import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createLearningResourceSchema, listLearningResourcesQuerySchema } from "@/lib/validation-schemas/learning-resources";
import { createLearningResourceService, listLearningResourcesService } from "@/services/learning-resource-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "learning_resources.view");
    const filters = listLearningResourcesQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const resources = await listLearningResourcesService(filters);
    return apiSuccess(resources);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "learning_resources.create");
    const body = await request.json();
    const input = createLearningResourceSchema.parse(body);
    const resource = await createLearningResourceService(input, { actorUserId: session.userId });
    return apiSuccess(resource, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
