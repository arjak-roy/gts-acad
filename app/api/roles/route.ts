import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createRoleSchema } from "@/lib/validation-schemas/rbac";
import { createRole, getRoles } from "@/services/rbac-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "roles.view");
    const roles = await getRoles();
    return apiSuccess(roles);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "roles.create");
    const body = await request.json();
    const input = createRoleSchema.parse(body);
    const role = await createRole(input, { actorUserId: session.userId });
    return apiSuccess(role, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
