import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { learnerIdSchema } from "@/lib/validation-schemas/learners";
import { getLearnerByCodeService } from "@/services/learners-service";

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