import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { cloneCurriculumSchema } from "@/lib/validation-schemas/curriculum";
import { cloneCurriculumService } from "@/services/curriculum-service";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "curriculum.create");
    const body = await request.json();
    const input = cloneCurriculumSchema.parse(body);
    const curriculum = await cloneCurriculumService(input, { actorUserId: session.userId });
    return apiSuccess(curriculum, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
