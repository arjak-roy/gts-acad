import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuthenticatedSession } from "@/lib/auth/route-guards";
import { prisma } from "@/lib/prisma-client";
import { getUserPermissions, getUserRoles } from "@/services/rbac-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthenticatedSession(request);

    const [{ permissions, roleCodes }, roles, dbUser] = await Promise.all([
      getUserPermissions(session.userId),
      getUserRoles(session.userId),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true, email: true, emailVerifiedAt: true, lastLoginAt: true },
      }),
    ]);

    return apiSuccess({
      user: {
        id: session.userId,
        name: dbUser?.name ?? session.name,
        email: dbUser?.email ?? session.email,
        role: session.role,
        emailVerifiedAt: dbUser?.emailVerifiedAt?.toISOString() ?? null,
        lastLoginAt: dbUser?.lastLoginAt?.toISOString() ?? null,
      },
      session: {
        id: session.sessionId ?? null,
        rememberMe: session.rememberMe === true,
        requiresPasswordReset: session.requiresPasswordReset === true,
        expiresAt: session.expiresAt ? new Date(session.expiresAt * 1_000).toISOString() : null,
      },
      permissions,
      roleCodes,
      roles: roles.map((role) => ({ code: role.code, name: role.name })),
    });
  } catch (error) {
    return apiError(error);
  }
}