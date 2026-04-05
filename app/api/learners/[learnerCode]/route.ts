import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { learnerIdSchema, updateLearnerSchema } from "@/lib/validation-schemas/learners";
import { getLearnerByCodeService, updateLearnerService } from "@/services/learners-service";

type LearnerRouteContext = {
  params: {
    learnerCode: string;
  };
};

export async function GET(request: NextRequest, { params }: LearnerRouteContext) {
  try {
    await requirePermission(request, "users.view");
    const { learnerCode } = learnerIdSchema.parse(params);
    const learner = await getLearnerByCodeService(learnerCode);

    if (!learner) {
      return apiError(new Error("Learner not found."));
    }

    return apiSuccess(learner);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: LearnerRouteContext) {
  try {
    const session = await requirePermission(request, "users.edit");
    const { learnerCode } = learnerIdSchema.parse(params);
    const body = await request.json();
    const input = updateLearnerSchema.parse(body);
    const learner = await updateLearnerService(learnerCode, input, session.userId);
    return apiSuccess(learner);
  } catch (error) {
    return apiError(error);
  }
}