import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { CANDIDATE_USERS_PERMISSIONS } from "@/lib/users/constants";
import { userIdSchema } from "@/lib/validation-schemas/users";
import { getUserSessionHistoryService } from "@/services/user-activity-service";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

type RouteContext = {
  params: {
    userId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, CANDIDATE_USERS_PERMISSIONS.view);
    const { userId } = userIdSchema.parse(params);

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const { page, pageSize } = querySchema.parse(searchParams);

    const result = await getUserSessionHistoryService(userId, page, pageSize);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
