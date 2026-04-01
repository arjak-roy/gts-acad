import { apiError, apiSuccess } from "@/lib/api-response";
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
export async function GET(_: Request, { params }: LearnerRouteContext) {
  try {
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