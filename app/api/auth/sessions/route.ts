import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuthenticatedSession } from "@/lib/auth/route-guards";
import { listUserSessions } from "@/services/auth/session-manager";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthenticatedSession(request);
    const sessions = await listUserSessions(session.userId, session.sessionId);

    return apiSuccess({
      items: sessions,
      currentSessionId: session.sessionId ?? null,
    });
  } catch (error) {
    return apiError(error);
  }
}