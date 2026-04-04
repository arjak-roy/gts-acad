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
        select: { name: true, email: true },
      }),
    ]);

    return apiSuccess({
      permissions,
      roleCodes,
      roles: roles.map((role) => ({ code: role.code, name: role.name })),
      user: { name: dbUser?.name ?? session.name, email: dbUser?.email ?? session.email },
    });
  } catch (error) {
    return apiError(error);
  }
}
