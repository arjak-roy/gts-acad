import { NextRequest } from "next/server";

import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuthenticatedSession } from "@/lib/auth/route-guards";
import { buildClearedAuthSessionCookie } from "@/lib/auth/session";
import { invalidateAllUserSessions } from "@/services/auth/session-manager";

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["POST", "OPTIONS"]);
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthenticatedSession(request);
    const response = apiSuccess({ ok: true });

    await invalidateAllUserSessions(session.userId, "logout-all");

    response.cookies.set(buildClearedAuthSessionCookie(request));
    return withCors(request, response, ["POST", "OPTIONS"]);
  } catch (error) {
    return withCors(request, apiError(error), ["POST", "OPTIONS"]);
  }
}