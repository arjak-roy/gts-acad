import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireRequestModuleAccess } from "@/lib/auth/access";
import { syncReadinessStatusSchema } from "@/lib/validation-schemas/readiness";
import { syncReadinessStatusService } from "@/services/readiness-service";

/**
 * Triggers readiness sync for a learner to an external destination.
 * Validates request payload and delegates orchestration to the service layer.
 * Revalidates pages that display recruiter sync status and readiness state.
 */
export async function POST(request: NextRequest) {
  try {
    await requireRequestModuleAccess(request, "readiness");
    const body = await request.json();
    const input = syncReadinessStatusSchema.parse(body);
    const result = await syncReadinessStatusService(input);

    revalidatePath("/dashboard");
    revalidatePath("/staff/learners");
    revalidatePath("/learners");
    revalidatePath("/readiness");

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}