import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { emailTemplateIdSchema } from "@/lib/validation-schemas/email-templates";
import { toggleEmailTemplateStatusService } from "@/services/email-templates";

type RouteContext = {
  params: {
    templateId: string;
  };
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "email_templates.edit");
    const { templateId } = emailTemplateIdSchema.parse(params);
    const template = await toggleEmailTemplateStatusService(templateId, session.userId);
    return apiSuccess(template);
  } catch (error) {
    return apiError(error);
  }
}
