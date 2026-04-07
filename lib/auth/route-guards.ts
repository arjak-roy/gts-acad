import type { NextRequest } from "next/server";

import type { AuthSessionClaims } from "@/lib/auth/session";
import { getAuthSession } from "@/lib/auth/session";
import { touchUserSessionActivity, validateAuthenticatedUserSession } from "@/services/auth/session-manager";
import { hasPermission, hasAnyPermission, getUserPermissions } from "@/services/rbac-service";

const candidateRoleCodes = new Set(["CANDIDATE"]);

export async function assertCandidateRole(userId: string) {
  const { roleCodes } = await getUserPermissions(userId);
  const isCandidateRole = roleCodes.some((code) => candidateRoleCodes.has(code));

  if (!isCandidateRole) {
    throw new Error("Forbidden: candidate role is required.");
  }
}

/**
 * Middleware-style auth guard for API route handlers.
 * Throws standardized errors so apiError can map HTTP status codes.
 */
export async function requireAuthenticatedSession(request: NextRequest): Promise<AuthSessionClaims> {
  const session = await getAuthSession(request);

  if (!session || session.state !== "authenticated") {
    throw new Error("Unauthorized: authenticated session required.");
  }

  const isValid = await validateAuthenticatedUserSession(session);
  if (!isValid) {
    throw new Error("Unauthorized: session expired or invalidated.");
  }

  if (session.sessionId) {
    await touchUserSessionActivity(session.userId, session.sessionId);
  }

  return session;
}

/**
 * Ensures the request comes from an authenticated candidate session.
 */
export async function requireCandidateSession(request: NextRequest): Promise<AuthSessionClaims> {
  const session = await requireAuthenticatedSession(request);
  await assertCandidateRole(session.userId);
  return session;
}

/**
 * Ensures the authenticated user has a specific permission.
 * Returns the session claims on success, throws Forbidden on failure.
 */
export async function requirePermission(request: NextRequest, permissionKey: string): Promise<AuthSessionClaims> {
  const session = await requireAuthenticatedSession(request);

  const allowed = await hasPermission(session.userId, permissionKey);
  if (!allowed) {
    throw new Error("Forbidden: insufficient permissions.");
  }

  return session;
}

/**
 * Ensures the authenticated user has at least one of the given permissions.
 */
export async function requireAnyPermission(request: NextRequest, permissionKeys: string[]): Promise<AuthSessionClaims> {
  const session = await requireAuthenticatedSession(request);

  const allowed = await hasAnyPermission(session.userId, permissionKeys);
  if (!allowed) {
    throw new Error("Forbidden: insufficient permissions.");
  }

  return session;
}
