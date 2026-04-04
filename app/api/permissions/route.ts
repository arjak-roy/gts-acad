import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { getAllPermissions } from "@/services/rbac-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "roles.view");
    const result = await getAllPermissions();
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
