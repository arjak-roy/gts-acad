import { generateEmailOtpCode, getTwoFactorCodeTtlMinutes } from "@/lib/auth/two-factor";
import { TWO_FACTOR_EMAIL_TEMPLATE_KEY } from "@/lib/mail-templates/email-template-defaults";
import { renderEmailTemplateByKeyService } from "@/services/email-templates";
import { deliverLoggedEmail } from "@/services/logs-actions-service";

export async function sendDemoTwoFactorMail(recipient: string) {
  const to = recipient.trim() || process.env.ADMIN_MAIL;
  if (!to) {
    throw new Error("Demo recipient email is not configured.");
  }

  const template = await renderEmailTemplateByKeyService(TWO_FACTOR_EMAIL_TEMPLATE_KEY, {
    appName: process.env.APP_NAME ?? "GTS Academy App",
    recipientName: "Demo Recipient",
    code: generateEmailOtpCode(),
    expiresInMinutes: getTwoFactorCodeTtlMinutes(),
    purposeLabel: "preview the email template",
  });

  await deliverLoggedEmail({
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: "TWO_FACTOR",
    templateKey: TWO_FACTOR_EMAIL_TEMPLATE_KEY,
    deliveryMode: "immediate",
    audit: {
      entityType: "SYSTEM",
      entityId: "demo-two-factor-mail",
    },
  });
}
