import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createLearnerEnrollmentSchema, learnerIdSchema } from "@/lib/validation-schemas/learners";
import { addLearnerEnrollmentService } from "@/services/learners-service";

type LearnerEnrollmentsRouteContext = {
  params: {
    learnerCode: string;
  };
};

export async function POST(request: NextRequest, { params }: LearnerEnrollmentsRouteContext) {
  try {
    await requirePermission(request, "users.edit");
    const { learnerCode } = learnerIdSchema.parse(params);
    const body = await request.json();
    const input = createLearnerEnrollmentSchema.parse(body);
    const learner = await addLearnerEnrollmentService(learnerCode, input);
    return apiSuccess(learner, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}