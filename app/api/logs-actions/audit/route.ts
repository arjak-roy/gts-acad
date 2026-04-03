import { apiError, apiSuccess } from "@/lib/api-response";
import { listAuditLogsSchema } from "@/lib/validation-schemas/logs-actions";
import { listAuditLogsService } from "@/services/logs-actions-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = listAuditLogsSchema.parse(Object.fromEntries(searchParams.entries()));
    const logs = await listAuditLogsService(input);
    return apiSuccess(logs);
  } catch (error) {
    return apiError(error);
  }
}
