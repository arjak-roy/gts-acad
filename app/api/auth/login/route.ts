import { NextRequest } from "next/server";
import { z } from "zod";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { buildAuthSessionCookie, createAuthSessionToken, FULL_SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";
import { getTwoFactorCodeTtlMinutes } from "@/lib/auth/two-factor";
import { loginWithPassword } from "@/services/auth-service";

const loginSchema = z.object({
  email: z.string().trim().email("Valid email is required."),
  password: z.string().trim().min(1, "Password is required."),
});

const candidateClientHeaderValue = "candidate-app";

type AuthenticatedUserPayload = {
  id: string;
  email: string;
  name: string;
  role: string;
};

function isCandidateTwoFactorBypassEnabled(request: NextRequest) {
  const isBypassEnabled = (process.env.CANDIDATE_LOGIN_SKIP_2FA ?? "false").toLowerCase() === "true";
  const isProduction = process.env.NODE_ENV === "production";
  const clientHeader = request.headers.get("x-gts-client");

  return isBypassEnabled && !isProduction && clientHeader === candidateClientHeaderValue;
}

async function buildAuthenticatedResponse(request: NextRequest, user: AuthenticatedUserPayload) {
  const response = apiSuccess({
    requiresTwoFactor: false,
    user,
  });

  const token = await createAuthSessionToken(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      state: "authenticated",
    },
    FULL_SESSION_MAX_AGE_SECONDS,
  );

  response.cookies.set(buildAuthSessionCookie(request, token, FULL_SESSION_MAX_AGE_SECONDS));
  return response;
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["POST", "OPTIONS"]);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);
    const result = await loginWithPassword(email, password);

    if (result.status === "authenticated") {
      const response = await buildAuthenticatedResponse(request, {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      });

      return withCors(request, response, ["POST", "OPTIONS"]);
    }

    if (isCandidateTwoFactorBypassEnabled(request)) {
      const response = await buildAuthenticatedResponse(request, {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      });

      return withCors(request, response, ["POST", "OPTIONS"]);
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
    return withCors(request, response, ["POST", "OPTIONS"]);
  } catch (error) {
    return withCors(request, apiError(error), ["POST", "OPTIONS"]);
  }
}
