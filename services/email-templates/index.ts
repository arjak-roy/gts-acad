import "server-only";

export type {
  EmailTemplateDetail,
  EmailTemplateSummary,
  SendTestEmailTemplateResult,
} from "@/services/email-templates/types";

export type {
  EmailTemplateCategorySummary,
} from "@/services/email-templates/categories";

export type {
  EmailTemplateVersionSummary,
  EmailTemplateVersionDetail,
} from "@/services/email-templates/versions";

export { ensureDefaultEmailTemplates } from "@/services/email-templates/defaults";

export {
  getEmailTemplateByIdService,
  listEmailTemplatesService,
} from "@/services/email-templates/queries";

export {
  createEmailTemplateService,
  updateEmailTemplateService,
  deleteEmailTemplateService,
  duplicateEmailTemplateService,
  toggleEmailTemplateStatusService,
} from "@/services/email-templates/commands";

export { renderEmailTemplateByKeyService } from "@/services/email-templates/render";

export { sendTestEmailTemplateService } from "@/services/email-templates/testing";

export { listEmailTemplateCategoriesService } from "@/services/email-templates/categories";

export {
  listEmailTemplateVersionsService,
  getEmailTemplateVersionDetailService,
} from "@/services/email-templates/versions";
