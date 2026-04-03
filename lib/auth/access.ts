import "server-only";

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import {
  AUTH_SESSION_COOKIE,
  CANDIDATE_SESSION_COOKIE,
  getAuthSession,
  getCandidateSession,
  hasPermission,
  verifyAuthSessionToken,
  verifyCandidateSessionToken,
  type AuthSessionClaims,
  type CandidateSessionClaims,
} from "@/lib/auth/session";
import { canAccessModule, isStaffSession, isSuperAdminSession, type StaffModuleKey } from "@/lib/auth/module-access";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export async function getCurrentAuthSession() {
  const token = cookies().get(AUTH_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  return verifyAuthSessionToken(token);
}

export async function getCurrentCandidateSession() {
  const token = cookies().get(CANDIDATE_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  return verifyCandidateSessionToken(token);
}

export async function requireCurrentAuthSession() {
  const session = await getCurrentAuthSession();

  if (!session || session.state !== "authenticated") {
    throw new Error("Authentication required.");
  }

  return session;
}

export async function requireCurrentCandidateSession() {
  const session = await getCurrentCandidateSession();

  if (!session || session.state !== "authenticated") {
    throw new Error("Candidate authentication required.");
  }

  return session;
}

export async function requireRequestAuthSession(request: NextRequest) {
  const session = await getAuthSession(request);

  if (!session || session.state !== "authenticated") {
    throw new Error("Authentication required.");
  }

  return session;
}

export async function requireRequestCandidateSession(request: NextRequest) {
  const session = await getCandidateSession(request);

  if (!session || session.state !== "authenticated") {
    throw new Error("Candidate authentication required.");
  }

  return session;
}

export function isAdminSession(session: Pick<AuthSessionClaims, "role" | "roles" | "permissions"> | null | undefined) {
  return isStaffSession(session);
}

export function requireAdminSession<T extends Pick<AuthSessionClaims, "role" | "roles" | "permissions">>(session: T) {
  if (!isAdminSession(session)) {
    throw new Error("Forbidden.");
  }

  return session;
}

export function requireSuperAdminSession<T extends Pick<AuthSessionClaims, "role" | "roles" | "permissions">>(session: T) {
  if (!isSuperAdminSession(session)) {
    throw new Error("Forbidden.");
  }

  return session;
}

export async function requireCurrentAdminSession() {
  return requireAdminSession(await requireCurrentAuthSession());
}

export async function requireRequestAdminSession(request: NextRequest) {
  return requireAdminSession(await requireRequestAuthSession(request));
}

export async function requireCurrentSuperAdminSession() {
  return requireSuperAdminSession(await requireCurrentAuthSession());
}

export async function requireRequestSuperAdminSession(request: NextRequest) {
  return requireSuperAdminSession(await requireRequestAuthSession(request));
}

export function requireModuleAccess<T extends Pick<AuthSessionClaims, "role" | "roles" | "permissions">>(session: T, moduleKey: StaffModuleKey) {
  if (!canAccessModule(session, moduleKey)) {
    throw new Error("Forbidden.");
  }

  return session;
}

export async function requireCurrentModuleAccess(moduleKey: StaffModuleKey) {
  return requireModuleAccess(await requireCurrentAuthSession(), moduleKey);
}

export async function requireRequestModuleAccess(request: NextRequest, moduleKey: StaffModuleKey) {
  return requireModuleAccess(await requireRequestAuthSession(request), moduleKey);
}

export async function getCurrentCandidateLearner(session: Pick<CandidateSessionClaims, "learnerId" | "learnerCode"> | null | undefined) {
  if (!session || !isDatabaseConfigured) {
    return null;
  }

  return prisma.learner.findFirst({
    where: {
      id: session.learnerId,
    },
    select: {
      id: true,
      learnerCode: true,
    },
  });
}

export async function assertCanAccessLearnerCode(
  session: Pick<AuthSessionClaims, "userId" | "role" | "roles" | "permissions"> | Pick<CandidateSessionClaims, "learnerId" | "learnerCode">,
  learnerCode: string,
) {
  if ("learnerCode" in session) {
    if (session.learnerCode !== learnerCode) {
      throw new Error("Forbidden.");
    }

    return;
  }

  if (canAccessModule(session, "learners") || hasPermission(session, "candidate:read")) {
    return;
  }

  if (!hasPermission(session, "candidate:read_own") || !isDatabaseConfigured) {
    throw new Error("Forbidden.");
  }

  const learner = await prisma.learner.findFirst({
    where: {
      learnerCode,
      userId: session.userId,
    },
    select: {
      id: true,
    },
  });

  if (!learner) {
    throw new Error("Forbidden.");
  }
}