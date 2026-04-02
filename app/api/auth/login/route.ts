import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { buildAuthSessionCookie, createAuthSessionToken, FULL_SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";
import { getTwoFactorCodeTtlMinutes } from "@/lib/auth/two-factor";
import { loginWithPassword } from "@/services/auth-service";

const loginSchema = z.object({
  email: z.string().trim().email("Valid email is required."),
  password: z.string().trim().min(1, "Password is required."),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);
    const result = await loginWithPassword(email, password);

    if (result.status === "authenticated") {
      const response = apiSuccess({
        requiresTwoFactor: false,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
        },
      });

      const token = await createAuthSessionToken(
        {
          userId: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          state: "authenticated",
        },
        FULL_SESSION_MAX_AGE_SECONDS,
      );

      response.cookies.set(buildAuthSessionCookie(request, token, FULL_SESSION_MAX_AGE_SECONDS));
      return response;
    }

    const pendingMaxAgeSeconds = getTwoFactorCodeTtlMinutes() * 60;
    const response = apiSuccess({
      requiresTwoFactor: true,
      maskedEmail: result.maskedEmail,
    });

    const token = await createAuthSessionToken(
      {
        userId: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        state: "pending",
        challengeId: result.challengeId,
        purpose: "LOGIN",
      },
      pendingMaxAgeSeconds,
    );

    response.cookies.set(buildAuthSessionCookie(request, token, pendingMaxAgeSeconds));
    return response;
  } catch (error) {
    return apiError(error);
  }
}
