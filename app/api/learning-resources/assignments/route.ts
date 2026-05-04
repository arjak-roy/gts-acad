import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { listAllAssignmentsService } from "@/services/learning-resource-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "learning_resources.view");
    const params = request.nextUrl.searchParams;

    const filters = {
      targetType: params.get("targetType") || undefined,
      targetId: params.get("targetId") || undefined,
      search: params.get("search") || undefined,
      page: params.has("page") ? Number(params.get("page")) : 1,
      pageSize: params.has("pageSize") ? Number(params.get("pageSize")) : 25,
    };

    const result = await listAllAssignmentsService(filters);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
