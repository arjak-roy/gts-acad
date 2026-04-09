import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { CANDIDATE_USERS_PERMISSIONS } from "@/lib/users/constants";
import { userIdSchema } from "@/lib/validation-schemas/users";
import { getUserActivityService } from "@/services/user-activity-service";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  activityType: z.string().optional(),
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
    const { page, pageSize, activityType } = querySchema.parse(searchParams);

    const result = await getUserActivityService({
      userId,
      page,
      pageSize,
      activityType: activityType as import("@prisma/client").UserActivityType | undefined,
    });

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
