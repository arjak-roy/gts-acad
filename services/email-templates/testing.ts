import { renderEmailTemplateSource } from "@/lib/mail-templates/email-template-defaults";
import { deliverLoggedEmail } from "@/services/logs-actions-service";
import { buildTestTemplateVariables } from "@/services/email-templates/helpers";
import { getEmailTemplateByIdService } from "@/services/email-templates/queries";
import { SendTestEmailTemplateResult } from "@/services/email-templates/types";

export async function sendTestEmailTemplateService(input: {
  templateId: string;
  recipientEmail: string;
  actorUserId: string;
  actorName: string;
}): Promise<SendTestEmailTemplateResult> {
  const template = await getEmailTemplateByIdService(input.templateId);
  if (!template) {
    throw new Error("Email template not found.");
  }

  const variables = buildTestTemplateVariables(template, input.recipientEmail, input.actorName);
  const rendered = renderEmailTemplateSource(
    {
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
    },
    variables,
  );

  const delivery = await deliverLoggedEmail({
    to: input.recipientEmail,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    category: "SYSTEM",
    templateKey: template.key,
    metadata: {
      reason: "template_test",
      templateId: template.id,
      templateKey: template.key,
    },
    audit: {
      actorUserId: input.actorUserId,
      entityId: template.id,
    },
  });

  return {
    templateId: template.id,
    templateKey: template.key,
    recipientEmail: input.recipientEmail,
    emailLogId: delivery.emailLogId,
    providerMessageId: delivery.providerMessageId,
  };
}
