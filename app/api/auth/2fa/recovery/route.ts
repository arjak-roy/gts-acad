import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { getAuthSession } from "@/lib/auth/session";
import { createAuthenticatedUserSession } from "@/services/auth/session-manager";
import { verifyRecoveryCode } from "@/services/auth-service";

const recoverySchema = z.object({
  recoveryCode: z.string().trim().min(3, "Recovery code is required."),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session || session.state !== "pending" || session.purpose !== "LOGIN" || !session.challengeId) {
      throw new Error("Recovery verification requires a pending two-factor session.");
    }

    const body = await request.json();
    const { recoveryCode } = recoverySchema.parse(body);
    const user = await verifyRecoveryCode(session.userId, session.challengeId, recoveryCode);
    const response = apiSuccess({ ok: true, requiresPasswordReset: user.requiresPasswordReset });

    const authenticatedSession = await createAuthenticatedUserSession(request, user, session.rememberMe === true);
    response.cookies.set(authenticatedSession.cookie);
    return response;
  } catch (error) {
    return apiError(error);
  }
}