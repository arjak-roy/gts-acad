import type { NextRequest } from "next/server";
import { z } from "zod";

import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { logUserActivity } from "@/services/user-activity-service";
import { getClientIpAddress } from "@/lib/auth/login-rate-limiter";

const METHODS = ["POST", "OPTIONS"];

const ALLOWED_ACTIVITY_TYPES = [
  "PAGE_VIEW",
  "LOGOUT",
] as const;

const activitySchema = z.object({
  activityType: z.enum(ALLOWED_ACTIVITY_TYPES),
  metadata: z.record(z.unknown()).optional().default({}),
});

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, METHODS);
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireCandidateSession(request);
    const body = await request.json();
    const { activityType, metadata } = activitySchema.parse(body);

    await logUserActivity({
      userId: session.userId,
      activityType,
      ipAddress: getClientIpAddress(request),
      userAgent: request.headers.get("user-agent"),
      sessionId: session.sessionId,
      metadata,
    });

    const response = apiSuccess({ logged: true });
    return withCors(request, response, METHODS);
  } catch (error) {
    return withCors(request, apiError(error), METHODS);
  }
}
