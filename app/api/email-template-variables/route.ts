import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createEmailTemplateVariableSchema } from "@/lib/validation-schemas/email-template-variables";
import {
  createEmailTemplateVariableService,
  listEmailTemplateVariablesService,
} from "@/services/email-templates/variables";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "email_templates.view");
    const variables = await listEmailTemplateVariablesService();
    return apiSuccess(variables);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "email_templates.create");
    const body = await request.json();
    const input = createEmailTemplateVariableSchema.parse(body);
    const variable = await createEmailTemplateVariableService(input);
    return apiSuccess(variable, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
