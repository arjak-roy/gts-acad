import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { emailTemplateIdSchema } from "@/lib/validation-schemas/email-templates";
import { duplicateEmailTemplateService } from "@/services/email-templates";

type RouteContext = {
  params: {
    templateId: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "email_templates.create");
    const { templateId } = emailTemplateIdSchema.parse(params);
    const template = await duplicateEmailTemplateService(templateId, session.userId);
    return apiSuccess(template, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
