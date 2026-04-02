import { apiError, apiSuccess } from "@/lib/api-response";
import { emailTemplateIdSchema, updateEmailTemplateSchema } from "@/lib/validation-schemas/email-templates";
import { getEmailTemplateByIdService, updateEmailTemplateService } from "@/services/email-templates-service";

type RouteContext = {
  params: {
    templateId: string;
  };
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { templateId } = emailTemplateIdSchema.parse(params);
    const template = await getEmailTemplateByIdService(templateId);

    if (!template) {
      throw new Error("Email template not found.");
    }

    return apiSuccess(template);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json();
    const input = updateEmailTemplateSchema.parse({ ...body, templateId: params.templateId });
    const template = await updateEmailTemplateService(input);
    return apiSuccess(template);
  } catch (error) {
    return apiError(error);
  }
}