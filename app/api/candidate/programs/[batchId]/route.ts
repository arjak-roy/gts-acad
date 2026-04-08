import type { NextRequest } from "next/server";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { batchIdSchema } from "@/lib/validation-schemas/batches";
import { listBatchAssessmentsService, listBatchContentService } from "@/services/batch-content-service";
import { getCurriculaForBatchService } from "@/services/curriculum-service";
import { getCandidateProfileByUserIdService } from "@/services/learners-service";
import { listScheduleEventsService } from "@/services/schedule-service";

type RouteContext = {
  params: {
    batchId: string;
  };
};

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["GET", "OPTIONS"]);
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireCandidateSession(request);
    const { batchId } = batchIdSchema.parse(params);
    const profile = await getCandidateProfileByUserIdService(session.userId);

    if (!profile) {
      throw new Error("Candidate profile not found.");
    }

    const enrollment = profile.activeEnrollments.find((item) => item.batchId === batchId);

    if (!enrollment) {
      throw new Error("Program not found.");
    }

    const [curriculumWorkspace, assessments, resources, scheduleResponse] = await Promise.all([
      getCurriculaForBatchService(batchId),
      listBatchAssessmentsService(batchId),
      listBatchContentService(batchId),
      listScheduleEventsService({ batchId, page: 1, pageSize: 100 }),
    ]);

    const { availableCurricula: _availableCurricula, ...curriculum } = curriculumWorkspace;

    const response = apiSuccess({
      enrollment,
      curriculum,
      assessments,
      resources,
      schedule: scheduleResponse.items,
    });

    return withCors(request, response, ["GET", "OPTIONS"]);
  } catch (error) {
    return withCors(request, apiError(error), ["GET", "OPTIONS"]);
  }
}