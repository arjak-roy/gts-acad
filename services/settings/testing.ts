import "server-only";

import { testMailConfiguration } from "@/lib/mail-service";
import type { SendSettingsTestEmailInput } from "@/lib/validation-schemas/settings";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { getEmailRuntimeSettings, getGeneralRuntimeSettings } from "@/services/settings/runtime";
import type { SendSettingsTestEmailResult } from "@/services/settings/types";

export async function sendSettingsTestEmailService(
  input: SendSettingsTestEmailInput,
  actor: { actorUserId?: string | null; fallbackRecipientEmail: string },
): Promise<SendSettingsTestEmailResult> {
  const savedEmailSettings = await getEmailRuntimeSettings();
  const generalSettings = await getGeneralRuntimeSettings();

  const configuration = {
    host: typeof input.values?.["email.smtp_host"] === "string" ? input.values["email.smtp_host"] : savedEmailSettings.smtpHost,
    port:
      typeof input.values?.["email.smtp_port"] === "number"
        ? input.values["email.smtp_port"]
        : typeof input.values?.["email.smtp_port"] === "string"
          ? Number.parseInt(input.values["email.smtp_port"], 10)
          : savedEmailSettings.smtpPort,
    username: typeof input.values?.["email.smtp_username"] === "string" ? input.values["email.smtp_username"] : savedEmailSettings.smtpUsername,
    password: typeof input.values?.["email.smtp_password"] === "string" && input.values["email.smtp_password"].trim().length > 0
      ? input.values["email.smtp_password"]
      : savedEmailSettings.smtpPassword,
    fromAddress:
      typeof input.values?.["email.sender_email_address"] === "string"
        ? input.values["email.sender_email_address"]
        : savedEmailSettings.senderEmailAddress,
    fromName:
      typeof input.values?.["email.sender_name"] === "string"
        ? input.values["email.sender_name"]
        : savedEmailSettings.senderName,
    secure:
      typeof input.values?.["email.enable_ssl_tls"] === "boolean"
        ? input.values["email.enable_ssl_tls"]
        : savedEmailSettings.enableSslTls,
  };

  const recipientEmail = input.recipientEmail?.trim() || actor.fallbackRecipientEmail;
  const delivery = await testMailConfiguration(
    configuration,
    {
      to: recipientEmail,
      subject: `${generalSettings.applicationName} SMTP Test`,
      text: `SMTP test email from ${generalSettings.applicationName}. If you received this message, the configured mail transport is working.`,
      html: `<div><h2>${generalSettings.applicationName} SMTP Test</h2><p>If you received this message, the configured mail transport is working.</p></div>`,
    },
  );

  await createAuditLogEntry({
    entityType: "SYSTEM",
    entityId: "settings-email-test",
    action: "UPDATED",
    message: `Settings test email sent to ${recipientEmail}.`,
    metadata: {
      category: "email",
      recipientEmail,
    },
    actorUserId: actor.actorUserId ?? null,
  });

  return {
    recipientEmail,
    providerMessageId: delivery.messageId ?? null,
  };
}