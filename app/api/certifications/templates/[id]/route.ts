import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { updateCertificateTemplateSchema } from "@/lib/validation-schemas/certifications";
import {
  getCertificateTemplateByIdService,
  updateCertificateTemplateService,
  deleteCertificateTemplateService,
} from "@/services/certifications";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requirePermission(request, "certifications.view");
    const { id } = await context.params;
    const template = await getCertificateTemplateByIdService(id);

    if (!template) {
      return apiError(new Error("Template not found."));
    }

    return apiSuccess(template);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(request, "certifications.edit");
    const { id } = await context.params;
    const body = await request.json();
    const input = updateCertificateTemplateSchema.parse(body);
    const template = await updateCertificateTemplateService(id, input, { actorUserId: session.userId });
    return apiSuccess(template);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(request, "certifications.delete");
    const { id } = await context.params;
    await deleteCertificateTemplateService(id, { actorUserId: session.userId });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
