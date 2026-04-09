import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { listEmailTemplateCategoriesService } from "@/services/email-templates";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "email_templates.view");
    const categories = await listEmailTemplateCategoriesService();
    return apiSuccess(categories);
  } catch (error) {
    return apiError(error);
  }
}
