import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { cloneContentToCourseService } from "@/services/course-content-service";
import { z } from "zod";

const cloneContentSchema = z.object({
  sourceContentIds: z.array(z.string().trim().min(1)).min(1, "At least one source content ID is required."),
  targetCourseId: z.string().trim().min(1, "Target course is required."),
  targetFolderId: z.string().trim().min(1).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "course_content.create");
    const body = await request.json();
    const input = cloneContentSchema.parse(body);
    const cloned = await cloneContentToCourseService(input, { actorUserId: session.userId });
    return apiSuccess(cloned, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
