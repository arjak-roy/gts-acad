import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { bulkRetryEmailLogsSchema, listEmailLogsSchema } from "@/lib/validation-schemas/logs-actions";
import { bulkRetryEmailLogsService, listEmailLogsService } from "@/services/logs-actions-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "logs.view");
    const { searchParams } = new URL(request.url);
    const input = listEmailLogsSchema.parse(Object.fromEntries(searchParams.entries()));
    const logs = await listEmailLogsService(input);
    return apiSuccess(logs);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "logs.view");
    const body = await request.json();
    const input = bulkRetryEmailLogsSchema.parse(body);
    const result = await bulkRetryEmailLogsService(input);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
