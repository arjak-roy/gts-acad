import { NextRequest } from "next/server";
import { z } from "zod";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { buildLoginRateLimitKey, clearLoginRateLimit, getLoginRateLimitStatus, registerFailedLoginAttempt } from "@/lib/auth/login-rate-limiter";
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
  requiresPasswordReset: boolean;
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
    requiresPasswordReset: user.requiresPasswordReset,
    user,
  });

  const token = await createAuthSessionToken(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      requiresPasswordReset: user.requiresPasswordReset,
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
  let rateLimitKey: string | null = null;

  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);
    const normalizedEmail = email.toLowerCase();

    rateLimitKey = buildLoginRateLimitKey(request, normalizedEmail);
    const rateLimitStatus = getLoginRateLimitStatus(rateLimitKey);
    if (!rateLimitStatus.allowed) {
      const response = apiError(new Error("Too many login attempts. Please try again later."));
      response.headers.set("Retry-After", String(rateLimitStatus.retryAfterSeconds));
      return withCors(request, response, ["POST", "OPTIONS"]);
    }

    const result = await loginWithPassword(email, password);
    clearLoginRateLimit(rateLimitKey);

    if (result.status === "authenticated") {
      const response = await buildAuthenticatedResponse(request, {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        requiresPasswordReset: result.user.requiresPasswordReset,
      });

      return withCors(request, response, ["POST", "OPTIONS"]);
    }

    if (isCandidateTwoFactorBypassEnabled(request)) {
      const response = await buildAuthenticatedResponse(request, {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        requiresPasswordReset: result.user.requiresPasswordReset,
      });

      return withCors(request, response, ["POST", "OPTIONS"]);
    }

    const pendingMaxAgeSeconds = getTwoFactorCodeTtlMinutes() * 60;
    const response = apiSuccess({
      requiresTwoFactor: true,
      requiresPasswordReset: result.user.requiresPasswordReset,
      maskedEmail: result.maskedEmail,
    });

    const token = await createAuthSessionToken(
      {
        userId: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        requiresPasswordReset: result.user.requiresPasswordReset,
        state: "pending",
        challengeId: result.challengeId,
        purpose: "LOGIN",
      },
      pendingMaxAgeSeconds,
    );

    response.cookies.set(buildAuthSessionCookie(request, token, pendingMaxAgeSeconds));
    return withCors(request, response, ["POST", "OPTIONS"]);
  } catch (error) {
    if (rateLimitKey && error instanceof Error && error.message === "Invalid email or password.") {
      const rateLimitResult = registerFailedLoginAttempt(rateLimitKey);
      if (!rateLimitResult.allowed) {
        const response = apiError(new Error("Too many login attempts. Please try again later."));
        response.headers.set("Retry-After", String(rateLimitResult.retryAfterSeconds));
        return withCors(request, response, ["POST", "OPTIONS"]);
      }
    }

    return withCors(request, apiError(error), ["POST", "OPTIONS"]);
  }
}
