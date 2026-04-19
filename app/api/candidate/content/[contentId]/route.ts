import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { contentIdSchema } from "@/lib/validation-schemas/course-content";
import { getCandidateAccessibleContentByIdService } from "@/services/course-content-service";

type RouteContext = { params: { contentId: string } };

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["GET", "OPTIONS"]);
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireCandidateSession(request);
    const { contentId } = contentIdSchema.parse(params);
    const content = await getCandidateAccessibleContentByIdService(session.userId, contentId);

    if (!content) {
      throw new Error("Content not found.");
    }

    if (content.kind === "blocked") {
      return withCors(request, NextResponse.json({
        error: "Content is currently locked.",
        code: "CURRICULUM_CONTENT_BLOCKED",
        contentId: content.contentId,
        title: content.title,
        availabilityStatus: content.availabilityStatus,
        availabilityReason: content.availabilityReason,
        contexts: content.contexts,
      }, { status: 423 }), ["GET", "OPTIONS"]);
    }

    const response = apiSuccess(content.content);
    return withCors(request, response, ["GET", "OPTIONS"]);
  } catch (error) {
    return withCors(request, apiError(error), ["GET", "OPTIONS"]);
  }
}