import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAnyPermission } from "@/lib/auth/route-guards";
import { syncLearningResourcesFromContentSchema } from "@/lib/validation-schemas/learning-resources";
import { syncLearningResourcesFromContentService } from "@/services/learning-resource-service";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAnyPermission(request, [
      "course_content.create",
      "course_content.edit",
      "learning_resources.create",
      "learning_resources.edit",
    ]);

    const body = await request.json();
    const input = syncLearningResourcesFromContentSchema.parse(body);
    const resources = await syncLearningResourcesFromContentService(input.contentIds, {
      actorUserId: session.userId,
      changeSummary: "Backfilled from repository explorer.",
    });

    return apiSuccess({
      count: resources.length,
      resources,
    });
  } catch (error) {
    return apiError(error);
  }
}