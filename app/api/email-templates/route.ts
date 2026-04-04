import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createEmailTemplateSchema } from "@/lib/validation-schemas/email-templates";
import { createEmailTemplateService, listEmailTemplatesService } from "@/services/email-templates-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "email_templates.view");
    const templates = await listEmailTemplatesService();
    return apiSuccess(templates);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "email_templates.create");
    const body = await request.json();
    const input = createEmailTemplateSchema.parse(body);
    const template = await createEmailTemplateService(input);
    return apiSuccess(template, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}