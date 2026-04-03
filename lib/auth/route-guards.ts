import type { NextRequest } from "next/server";

import type { AuthSessionClaims } from "@/lib/auth/session";
import { getAuthSession } from "@/lib/auth/session";

const candidateRoles = new Set(["CANDIDATE", "LEARNER"]);

/**
 * Middleware-style auth guard for API route handlers.
 * Throws standardized errors so apiError can map HTTP status codes.
 */
export async function requireAuthenticatedSession(request: NextRequest): Promise<AuthSessionClaims> {
  const session = await getAuthSession(request);

  if (!session || session.state !== "authenticated") {
    throw new Error("Unauthorized: authenticated session required.");
  }

  return session;
}

/**
 * Ensures the request comes from an authenticated candidate session.
 */
export async function requireCandidateSession(request: NextRequest): Promise<AuthSessionClaims> {
  const session = await requireAuthenticatedSession(request);

  if (!candidateRoles.has(session.role.toUpperCase())) {
    throw new Error("Forbidden: candidate role is required.");
  }

  return session;
}
