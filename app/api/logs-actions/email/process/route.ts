import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { processEmailLogsSchema } from "@/lib/validation-schemas/logs-actions";
import { processEmailLogsService } from "@/services/logs-actions-service";

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "logs.view");
    const body = await request.json().catch(() => ({}));
    const input = processEmailLogsSchema.parse(body);
    const result = await processEmailLogsService(input);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}