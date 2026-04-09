export type EmailTemplateSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  variables: string[];
  isSystem: boolean;
  isActive: boolean;
  categoryId: string | null;
  categoryName: string | null;
  updatedByName: string | null;
  updatedAt: string;
};

export type EmailTemplateDetail = EmailTemplateSummary & {
  htmlContent: string;
  textContent: string;
  createdAt: string;
};

export type SendTestEmailTemplateResult = {
  templateId: string;
  templateKey: string;
  recipientEmail: string;
  emailLogId: string | null;
  providerMessageId: string | null;
};

export type EmailTemplateRecord = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  htmlContent: string;
  textContent: string | null;
  variables: string[];
  isSystem: boolean;
  isActive: boolean;
  categoryId: string | null;
  category: { name: string } | null;
  updatedBy: { name: string } | null;
  createdAt: Date;
  updatedAt: Date;
};
