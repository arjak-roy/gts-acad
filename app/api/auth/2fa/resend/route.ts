import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { buildAuthSessionCookie, createAuthSessionToken, getAuthSession } from "@/lib/auth/session";
import { getTwoFactorCodeTtlMinutes } from "@/lib/auth/two-factor";
import { resendLoginTwoFactor } from "@/services/auth-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session || session.state !== "pending" || session.purpose !== "LOGIN" || !session.challengeId) {
      throw new Error("Resending a code requires a pending two-factor session.");
    }

    const result = await resendLoginTwoFactor(session.userId, session.challengeId);
    const pendingMaxAgeSeconds = getTwoFactorCodeTtlMinutes() * 60;
    const response = apiSuccess({ maskedEmail: result.maskedEmail });
    const token = await createAuthSessionToken(
      {
        ...session,
        challengeId: result.challengeId,
      },
      pendingMaxAgeSeconds,
    );

    response.cookies.set(buildAuthSessionCookie(request, token, pendingMaxAgeSeconds));
    return response;
  } catch (error) {
    return apiError(error);
  }
}