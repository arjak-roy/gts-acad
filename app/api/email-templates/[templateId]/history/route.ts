import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { emailTemplateIdSchema } from "@/lib/validation-schemas/email-templates";
import { listEmailTemplateVersionsService } from "@/services/email-templates";

type RouteContext = {
  params: {
    templateId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "email_templates.view");
    const { templateId } = emailTemplateIdSchema.parse(params);
    const versions = await listEmailTemplateVersionsService(templateId);
    return apiSuccess(versions);
  } catch (error) {
    return apiError(error);
  }
}
