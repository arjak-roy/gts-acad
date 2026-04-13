import type { NextRequest } from "next/server";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { assessmentPoolIdSchema, gradeSubmissionSchema, saveAssessmentDraftSchema } from "@/lib/validation-schemas/assessment-pool";
import { batchIdSchema } from "@/lib/validation-schemas/batches";
import {
  getCandidateAssessmentDetailService,
  saveCandidateAssessmentDraftService,
  submitCandidateAssessmentService,
} from "@/services/assessment-pool-service";

type RouteContext = {
  params: {
    poolId: string;
  };
};

function parseBatchId(request: NextRequest) {
  return batchIdSchema.parse({
    batchId: request.nextUrl.searchParams.get("batchId") ?? "",
  }).batchId;
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["GET", "PATCH", "POST", "OPTIONS"]);
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireCandidateSession(request);
    const { poolId } = assessmentPoolIdSchema.parse(params);
    const batchId = parseBatchId(request);
    const detail = await getCandidateAssessmentDetailService({
      userId: session.userId,
      batchId,
      assessmentPoolId: poolId,
    });

    return withCors(request, apiSuccess(detail), ["GET", "PATCH", "POST", "OPTIONS"]);
  } catch (error) {
    return withCors(request, apiError(error), ["GET", "PATCH", "POST", "OPTIONS"]);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireCandidateSession(request);
    const { poolId } = assessmentPoolIdSchema.parse(params);
    const batchId = parseBatchId(request);
    const body = await request.json();
    const { answers } = saveAssessmentDraftSchema.parse(body);
    const result = await saveCandidateAssessmentDraftService({
      userId: session.userId,
      batchId,
      assessmentPoolId: poolId,
      answers,
    });

    return withCors(request, apiSuccess(result), ["GET", "PATCH", "POST", "OPTIONS"]);
  } catch (error) {
    return withCors(request, apiError(error), ["GET", "PATCH", "POST", "OPTIONS"]);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireCandidateSession(request);
    const { poolId } = assessmentPoolIdSchema.parse(params);
    const batchId = parseBatchId(request);
    const body = await request.json();
    const { answers } = gradeSubmissionSchema.parse(body);
    const result = await submitCandidateAssessmentService({
      userId: session.userId,
      batchId,
      assessmentPoolId: poolId,
      answers,
    });

    return withCors(request, apiSuccess(result), ["GET", "PATCH", "POST", "OPTIONS"]);
  } catch (error) {
    return withCors(request, apiError(error), ["GET", "PATCH", "POST", "OPTIONS"]);
  }
}