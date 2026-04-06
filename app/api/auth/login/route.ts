import { NextRequest } from "next/server";
import { z } from "zod";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { buildLoginRateLimitKey, clearLoginRateLimit, getLoginRateLimitStatus, registerFailedLoginAttempt } from "@/lib/auth/login-rate-limiter";
import { buildAuthSessionCookie, createAuthSessionToken } from "@/lib/auth/session";
import { getTwoFactorCodeTtlMinutes } from "@/lib/auth/two-factor";
import { AccountActivationRequiredError } from "@/services/auth/account-activation";
import { LoginLockedError } from "@/services/auth/login-lockout";
import { createAuthenticatedUserSession } from "@/services/auth/session-manager";
import { loginWithPassword } from "@/services/auth";

const loginSchema = z.object({
  email: z.string().trim().email("Valid email is required."),
  password: z.string().trim().min(1, "Password is required."),
  rememberMe: z.boolean().optional().default(false),
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

async function buildAuthenticatedResponse(request: NextRequest, user: AuthenticatedUserPayload, rememberMe: boolean) {
  const response = apiSuccess({
    requiresTwoFactor: false,
    requiresPasswordReset: user.requiresPasswordReset,
    user,
  });

  const authenticatedSession = await createAuthenticatedUserSession(request, user, rememberMe);
  response.cookies.set(authenticatedSession.cookie);
  return response;
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["POST", "OPTIONS"]);
}

export async function POST(request: NextRequest) {
  let rateLimitKey: string | null = null;

  try {
    const body = await request.json();
    const { email, password, rememberMe } = loginSchema.parse(body);
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
      }, rememberMe);

      return withCors(request, response, ["POST", "OPTIONS"]);
    }

    if (isCandidateTwoFactorBypassEnabled(request)) {
      const response = await buildAuthenticatedResponse(request, {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        requiresPasswordReset: result.user.requiresPasswordReset,
      }, rememberMe);

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
        rememberMe,
        challengeId: result.challengeId,
        purpose: "LOGIN",
      },
      pendingMaxAgeSeconds,
    );

    response.cookies.set(buildAuthSessionCookie(request, token, pendingMaxAgeSeconds));
    return withCors(request, response, ["POST", "OPTIONS"]);
  } catch (error) {
    if (rateLimitKey && error instanceof AccountActivationRequiredError) {
      clearLoginRateLimit(rateLimitKey);
    }

    if (error instanceof LoginLockedError) {
      const response = apiError(error);
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
      return withCors(request, response, ["POST", "OPTIONS"]);
    }

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
