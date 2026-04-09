import type { NextRequest } from "next/server";

import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { assertCandidateRole } from "@/lib/auth/route-guards";
import { buildClearedAuthSessionCookie, getAuthSession } from "@/lib/auth/session";
import { maskEmail } from "@/lib/auth/two-factor";
import { prisma } from "@/lib/prisma-client";
import { touchUserSessionActivity, validateAuthenticatedUserSession } from "@/services/auth/session-manager";

const METHODS = ["GET", "OPTIONS"];

function buildUnauthenticatedResponse(request: NextRequest, clearCookie: boolean) {
  const response = apiSuccess({ status: "unauthenticated" as const });

  if (clearCookie) {
    response.cookies.set(buildClearedAuthSessionCookie(request));
  }

  return withCors(request, response, METHODS);
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, METHODS);
}

export async function GET(request: NextRequest) {
  const session = await getAuthSession(request);

  if (!session) {
    return buildUnauthenticatedResponse(request, false);
  }

  try {
    if (session.state === "pending") {
      if (session.purpose !== "LOGIN") {
        return buildUnauthenticatedResponse(request, true);
      }

      const response = apiSuccess({
        status: "two-factor-required" as const,
        maskedEmail: maskEmail(session.email),
      });

      return withCors(request, response, METHODS);
    }

    if (session.state !== "authenticated") {
      return buildUnauthenticatedResponse(request, true);
    }

    const isValid = await validateAuthenticatedUserSession(session);
    if (!isValid) {
      return buildUnauthenticatedResponse(request, true);
    }

    // Defense-in-depth: reject deactivated users even if session token is technically valid.
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isActive: true },
    });

    if (!user || !user.isActive) {
      return buildUnauthenticatedResponse(request, true);
    }

    await assertCandidateRole(session.userId);

    if (session.sessionId) {
      await touchUserSessionActivity(session.userId, session.sessionId);
    }

    const response = apiSuccess({
      status: "authenticated" as const,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
      },
      requiresPasswordReset: session.requiresPasswordReset === true,
      rememberMe: session.rememberMe === true,
      expiresAt: session.expiresAt ? new Date(session.expiresAt * 1_000).toISOString() : null,
    });

    return withCors(request, response, METHODS);
  } catch (error) {
    const response = apiError(error);

    if (error instanceof Error) {
      const normalizedMessage = error.message.toLowerCase();
      if (normalizedMessage.includes("unauthorized") || normalizedMessage.includes("forbidden")) {
        response.cookies.set(buildClearedAuthSessionCookie(request));
      }
    }

    return withCors(request, response, METHODS);
  }
}