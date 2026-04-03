import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { assertCanAccessLearnerCode, requireRequestAuthSession } from "@/lib/auth/access";
import { learnerIdSchema } from "@/lib/validation-schemas/learners";
import { getLearnerByCodeService } from "@/services/learners-service";

type LearnerRouteContext = {
  params: {
    learnerCode: string;
  };
};

/**
 * Returns one learner detail payload addressed by learner code.
 * Validates route params before hitting the data service.
 * Emits a standardized not-found error when no learner is resolved.
 */
export async function GET(request: NextRequest, { params }: LearnerRouteContext) {
  try {
    const session = await requireRequestAuthSession(request);
    const { learnerCode } = learnerIdSchema.parse(params);
    await assertCanAccessLearnerCode(session, learnerCode);
    const learner = await getLearnerByCodeService(learnerCode);

    if (!learner) {
      return apiError(new Error("Learner not found."));
    }

    return apiSuccess(learner);
  } catch (error) {
    return apiError(error);
  }
}