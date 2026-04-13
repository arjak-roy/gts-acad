import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { languageLabAnalyticsFiltersSchema } from "@/lib/validation-schemas/language-lab";
import { getLanguageLabRoleplayAnalyticsService } from "@/services/language-lab-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "lms.view");
    const input = languageLabAnalyticsFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const analytics = await getLanguageLabRoleplayAnalyticsService(input);
    return apiSuccess(analytics);
  } catch (error) {
    return apiError(error);
  }
}