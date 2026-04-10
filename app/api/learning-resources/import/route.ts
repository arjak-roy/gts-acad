import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { importLearningResourceSchema } from "@/lib/validation-schemas/learning-resources";
import { importCourseContentToLearningResourceService } from "@/services/learning-resource-service";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "learning_resources.create");
    const body = await request.json();
    const input = importLearningResourceSchema.parse(body);
    const resource = await importCourseContentToLearningResourceService(input, { actorUserId: session.userId });
    return apiSuccess(resource, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
