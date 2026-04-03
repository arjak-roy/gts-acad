import { apiError, apiSuccess } from "@/lib/api-response";
import { createLearnerEnrollmentSchema, learnerIdSchema } from "@/lib/validation-schemas/learners";
import { addLearnerEnrollmentService } from "@/services/learners-service";

type LearnerEnrollmentsRouteContext = {
  params: {
    learnerCode: string;
  };
};

export async function POST(request: Request, { params }: LearnerEnrollmentsRouteContext) {
  try {
    const { learnerCode } = learnerIdSchema.parse(params);
    const body = await request.json();
    const input = createLearnerEnrollmentSchema.parse(body);
    const learner = await addLearnerEnrollmentService(learnerCode, input);
    return apiSuccess(learner, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}