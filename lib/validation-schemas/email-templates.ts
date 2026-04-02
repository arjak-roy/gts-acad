import { z } from "zod";

export const createEmailTemplateSchema = z.object({
  key: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(500).optional().default(""),
  subject: z.string().trim().min(3).max(255),
  htmlContent: z.string().trim().min(10).max(100_000),
  textContent: z.string().max(50_000).optional().default(""),
  isActive: z.coerce.boolean().optional().default(true),
});

export const emailTemplateIdSchema = z.object({
  templateId: z.string().trim().min(1),
});

export const updateEmailTemplateSchema = createEmailTemplateSchema.extend({
  templateId: z.string().trim().min(1),
});

export type CreateEmailTemplateInput = z.infer<typeof createEmailTemplateSchema>;
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>;