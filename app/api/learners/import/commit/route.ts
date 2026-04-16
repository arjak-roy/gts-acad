import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { commitLearnerImportSchema } from "@/lib/validation-schemas/learners";
import { commitLearnerImportService } from "@/services/learners-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "users.create");
    const body = await request.json();
    const input = commitLearnerImportSchema.parse(body);
    const result = await commitLearnerImportService(input, { actorUserId: session.userId });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}