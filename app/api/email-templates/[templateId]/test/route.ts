import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuthenticatedSession } from "@/lib/auth/route-guards";
import { emailTemplateIdSchema, sendTestEmailTemplateSchema } from "@/lib/validation-schemas/email-templates";
import { sendTestEmailTemplateService } from "@/services/email-templates-service";

type RouteContext = {
  params: {
    templateId: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { templateId } = emailTemplateIdSchema.parse(params);
    const session = await requireAuthenticatedSession(request);
    const body = await request.json().catch(() => ({}));
    const input = sendTestEmailTemplateSchema.parse(body);

    const recipientEmail = (input.recipientEmail ?? session.email).trim().toLowerCase();
    const result = await sendTestEmailTemplateService({
      templateId,
      recipientEmail,
      actorUserId: session.userId,
      actorName: session.name,
    });

    return apiSuccess(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
