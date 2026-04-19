import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { certificateAutoIssueAttemptStatusEnum } from "@/lib/validation-schemas/certifications";
import { listCertificateAutoIssueAttemptsService } from "@/services/certifications/auto-issue-attempts";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "certifications.view");

    const courseId = request.nextUrl.searchParams.get("courseId");
    if (!courseId) {
      return apiSuccess([]);
    }

    const statusParam = request.nextUrl.searchParams.get("status");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const status = statusParam ? certificateAutoIssueAttemptStatusEnum.parse(statusParam) : undefined;
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    if (limitParam && (parsedLimit === undefined || !Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > 100)) {
      throw new Error("Invalid limit.");
    }

    const attempts = await listCertificateAutoIssueAttemptsService({
      courseId,
      status,
      limit: parsedLimit,
      openOnly: status === undefined || status === "FAILED",
    });

    return apiSuccess(attempts);
  } catch (error) {
    return apiError(error);
  }
}