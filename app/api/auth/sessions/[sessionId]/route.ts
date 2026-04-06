import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuthenticatedSession } from "@/lib/auth/route-guards";
import { buildClearedAuthSessionCookie } from "@/lib/auth/session";
import { revokeUserSession } from "@/services/auth/session-manager";

const sessionIdSchema = z.object({
  sessionId: z.string().uuid("Valid session id is required."),
});

type RouteContext = {
  params: {
    sessionId: string;
  };
};

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuthenticatedSession(request);
    const { sessionId } = sessionIdSchema.parse(params);

    await revokeUserSession(session.userId, sessionId, "session-terminated");

    const response = apiSuccess({ ok: true, terminatedSessionId: sessionId });

    if (session.sessionId === sessionId) {
      response.cookies.set(buildClearedAuthSessionCookie(request));
    }

    return response;
  } catch (error) {
    return apiError(error);
  }
}