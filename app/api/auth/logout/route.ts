import { NextRequest, NextResponse } from "next/server";

import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { buildClearedAuthSessionCookie, getAuthSession } from "@/lib/auth/session";
import { revokeUserSession } from "@/services/auth/session-manager";
import { logUserActivity } from "@/services/user-activity-service";
import { getClientIpAddress } from "@/lib/auth/login-rate-limiter";

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["POST", "OPTIONS"]);
}

export async function POST(request: NextRequest) {
  const session = await getAuthSession(request);

  if (session?.state === "authenticated" && session.sessionId) {
    await revokeUserSession(session.userId, session.sessionId, "logout");

    logUserActivity({
      userId: session.userId,
      activityType: "LOGOUT",
      ipAddress: getClientIpAddress(request),
      userAgent: request.headers.get("user-agent"),
      sessionId: session.sessionId,
    }).catch(() => {});
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(buildClearedAuthSessionCookie(request));
  return withCors(request, response, ["POST", "OPTIONS"]);
}
