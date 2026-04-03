import { apiError, apiSuccess } from "@/lib/api-response";
import { emailLogIdSchema } from "@/lib/validation-schemas/logs-actions";
import { retryEmailLogService } from "@/services/logs-actions-service";

type RouteContext = {
  params: {
    emailLogId: string;
  };
};

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { emailLogId } = emailLogIdSchema.parse(params);
    const result = await retryEmailLogService(emailLogId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
