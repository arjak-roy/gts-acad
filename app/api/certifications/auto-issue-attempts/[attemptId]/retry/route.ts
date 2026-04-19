import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { retryCertificateAutoIssueAttemptService } from "@/services/certifications/auto-issue";

type RouteContext = { params: Promise<{ attemptId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(request, "certifications.edit");
    const { attemptId } = await context.params;

    const result = await retryCertificateAutoIssueAttemptService(attemptId, {
      actorUserId: session.userId,
    });

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}