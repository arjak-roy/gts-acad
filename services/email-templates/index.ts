import "server-only";

export type {
  EmailTemplateDetail,
  EmailTemplateSummary,
  SendTestEmailTemplateResult,
} from "@/services/email-templates/types";

export { ensureDefaultEmailTemplates } from "@/services/email-templates/defaults";

export {
  getEmailTemplateByIdService,
  listEmailTemplatesService,
} from "@/services/email-templates/queries";

export {
  createEmailTemplateService,
  updateEmailTemplateService,
} from "@/services/email-templates/commands";

export { renderEmailTemplateByKeyService } from "@/services/email-templates/render";

export { sendTestEmailTemplateService } from "@/services/email-templates/testing";
