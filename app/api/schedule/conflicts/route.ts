import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { conflictCheckSchema } from "@/lib/validation-schemas/schedule";
import { checkTrainerConflicts } from "@/services/schedule";

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "schedule.view");
    const body = await request.json();
    const input = conflictCheckSchema.parse(body);
    const result = await checkTrainerConflicts(
      input.trainerProfileId,
      new Date(input.startsAt),
      new Date(input.endsAt),
      input.excludeEventId ?? null,
    );
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
