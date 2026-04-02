"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentModuleAccess } from "@/lib/auth/access";
import { syncReadinessStatusSchema } from "@/lib/validation-schemas/readiness";
import { syncReadinessStatusService } from "@/services/readiness-service";

/**
 * Validates readiness sync requests triggered from learner-facing workflows.
 * Runs service-level sync orchestration and status persistence.
 * Revalidates affected routes to reflect updated recruiter sync state.
 */
export async function syncReadinessStatus(input: unknown) {
  await requireCurrentModuleAccess("readiness");
  const parsed = syncReadinessStatusSchema.parse(input);
  const result = await syncReadinessStatusService(parsed);

  revalidatePath("/dashboard");
  revalidatePath("/learners");
  revalidatePath("/readiness");

  return result;
}