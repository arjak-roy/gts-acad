import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { emailLogIdSchema } from "@/lib/validation-schemas/logs-actions";
import { retryEmailLogService } from "@/services/logs-actions-service";

type RouteContext = {
  params: {
    emailLogId: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "logs.view");
    const { emailLogId } = emailLogIdSchema.parse(params);
    const result = await retryEmailLogService(emailLogId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
