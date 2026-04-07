import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { gradeSubmissionSchema } from "@/lib/validation-schemas/assessment-pool";
import { gradeSubmissionService } from "@/services/assessment-pool-service";

type RouteContext = { params: { poolId: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "assessments.edit");
    const body = await request.json();
    const { answers } = gradeSubmissionSchema.parse(body);
    const report = await gradeSubmissionService(
      params.poolId,
      answers.map((a) => ({ questionId: a.questionId, answer: a.answer ?? null })),
    );
    return apiSuccess(report);
  } catch (error) {
    return apiError(error);
  }
}
