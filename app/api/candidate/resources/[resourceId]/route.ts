import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { resourceIdSchema } from "@/lib/validation-schemas/learning-resources";
import { getCandidateAccessibleResourceByIdService } from "@/services/course-content-service";

type RouteContext = { params: { resourceId: string } };

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["GET", "OPTIONS"]);
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireCandidateSession(request);
    const { resourceId } = resourceIdSchema.parse(params);
    const result = await getCandidateAccessibleResourceByIdService(session.userId, resourceId);

    if (!result) {
      throw new Error("Resource not found.");
    }

    if (result.kind === "blocked") {
      return withCors(request, NextResponse.json({
        error: "Resource is currently locked.",
        code: "CURRICULUM_CONTENT_BLOCKED",
        resourceId: result.resourceId,
        title: result.title,
        availabilityStatus: result.availabilityStatus,
        availabilityReason: result.availabilityReason,
        contexts: result.contexts,
      }, { status: 423 }), ["GET", "OPTIONS"]);
    }

    const response = apiSuccess(result.content);
    return withCors(request, response, ["GET", "OPTIONS"]);
  } catch (error) {
    return withCors(request, apiError(error), ["GET", "OPTIONS"]);
  }
}
