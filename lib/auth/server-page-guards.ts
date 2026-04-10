import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_SESSION_COOKIE, type AuthSessionClaims, verifyAuthSessionToken } from "@/lib/auth/session";
import { touchUserSessionActivity, validateAuthenticatedUserSession } from "@/services/auth/session-manager";
import { hasAnyPermission, hasPermission } from "@/services/rbac-service";

async function requireAuthenticatedServerSession(): Promise<AuthSessionClaims> {
  const token = cookies().get(AUTH_SESSION_COOKIE)?.value;

  if (!token) {
    redirect("/login");
  }

  const session = await verifyAuthSessionToken(token);

  if (!session || session.state !== "authenticated") {
    redirect("/login");
  }

  const isValid = await validateAuthenticatedUserSession(session);

  if (!isValid) {
    redirect("/login");
  }

  if (session.sessionId) {
    await touchUserSessionActivity(session.userId, session.sessionId);
  }

  return session;
}

export async function requireServerPermission(permissionKey: string): Promise<AuthSessionClaims> {
  const session = await requireAuthenticatedServerSession();
  const allowed = await hasPermission(session.userId, permissionKey);

  if (!allowed) {
    redirect("/access-denied");
  }

  return session;
}

export async function requireServerAnyPermission(permissionKeys: string[]): Promise<AuthSessionClaims> {
  const session = await requireAuthenticatedServerSession();
  const allowed = await hasAnyPermission(session.userId, permissionKeys);

  if (!allowed) {
    redirect("/access-denied");
  }

  return session;
}