import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { STAFF_USERS_PERMISSIONS } from "@/lib/users/constants";
import { createUserSchema, getUsersSchema } from "@/lib/validation-schemas/users";
import { createInternalUserService, getUsersService } from "@/services/users";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, STAFF_USERS_PERMISSIONS.view);
    const { searchParams } = new URL(request.url);
    const input = getUsersSchema.parse(Object.fromEntries(searchParams.entries()));
    const users = await getUsersService(input);
    return apiSuccess(users);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, STAFF_USERS_PERMISSIONS.create);
    const body = await request.json();
    const input = createUserSchema.parse(body);
    const user = await createInternalUserService(input, {
      actorUserId: session.userId,
      actorRoleCode: session.role,
    });
    return apiSuccess(user, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
