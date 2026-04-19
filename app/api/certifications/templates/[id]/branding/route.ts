import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { updateTemplateBrandingSchema } from "@/lib/validation-schemas/certifications";
import { saveTemplateBrandingService } from "@/services/certifications";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(request, "certifications.edit");
    const { id } = await context.params;
    const body = await request.json();
    const input = updateTemplateBrandingSchema.parse(body);
    await saveTemplateBrandingService(id, input, { actorUserId: session.userId });
    return apiSuccess({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}
