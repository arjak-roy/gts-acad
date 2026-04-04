import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createLearnerSchema, getLearnersSchema } from "@/lib/validation-schemas/learners";
import { createLearnerService, getLearnersService } from "@/services/learners-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "users.view");
    const { searchParams } = new URL(request.url);
    const input = getLearnersSchema.parse(Object.fromEntries(searchParams.entries()));
    const learners = await getLearnersService(input);
    return apiSuccess(learners);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "users.create");
    const body = await request.json();
    const input = createLearnerSchema.parse(body);
    const learner = await createLearnerService(input);
    return apiSuccess(learner, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}