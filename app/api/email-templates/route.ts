import { apiError, apiSuccess } from "@/lib/api-response";
import { createEmailTemplateSchema } from "@/lib/validation-schemas/email-templates";
import { createEmailTemplateService, listEmailTemplatesService } from "@/services/email-templates-service";

export async function GET() {
  try {
    const templates = await listEmailTemplatesService();
    return apiSuccess(templates);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = createEmailTemplateSchema.parse(body);
    const template = await createEmailTemplateService(input);
    return apiSuccess(template, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}