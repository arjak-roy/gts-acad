import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { buildAuthSessionCookie, createAuthSessionToken, FULL_SESSION_MAX_AGE_SECONDS, getAuthSession } from "@/lib/auth/session";
import { persistAuthenticatedSession, verifyLoginTwoFactor } from "@/services/auth-service";

const verifySchema = z.object({
  code: z.string().trim().min(6, "Verification code is required.").max(6, "Verification code must be 6 digits."),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session || session.state !== "pending" || session.purpose !== "LOGIN" || !session.challengeId) {
      throw new Error("Login verification requires a pending two-factor session.");
    }

    const body = await request.json();
    const { code } = verifySchema.parse(body);
    const user = await verifyLoginTwoFactor(session.userId, session.challengeId, code);
    const response = apiSuccess({ ok: true });

    const token = await createAuthSessionToken(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        roles: user.roles,
        permissions: user.permissions,
        state: "authenticated",
      },
      FULL_SESSION_MAX_AGE_SECONDS,
    );

    await persistAuthenticatedSession(user, token, FULL_SESSION_MAX_AGE_SECONDS);

    response.cookies.set(buildAuthSessionCookie(request, token, FULL_SESSION_MAX_AGE_SECONDS));
    return response;
  } catch (error) {
    return apiError(error);
  }
}