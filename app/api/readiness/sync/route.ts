import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { syncReadinessStatusSchema } from "@/lib/validation-schemas/readiness";
import { syncReadinessStatusService } from "@/services/readiness-service";

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "readiness.manage");
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