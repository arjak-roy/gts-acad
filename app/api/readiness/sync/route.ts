import { revalidatePath } from "next/cache";

import { apiError, apiSuccess } from "@/lib/api-response";
import { syncReadinessStatusSchema } from "@/lib/validation-schemas/readiness";
import { syncReadinessStatusService } from "@/services/readiness-service";

/**
 * Triggers readiness sync for a learner to an external destination.
 * Validates request payload and delegates orchestration to the service layer.
 * Revalidates pages that display recruiter sync status and readiness state.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = syncReadinessStatusSchema.parse(body);
    const result = await syncReadinessStatusService(input);

    revalidatePath("/dashboard");
    revalidatePath("/learners");
    revalidatePath("/readiness");

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}