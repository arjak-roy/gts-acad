import { z } from "zod";

export const createEmailTemplateVariableSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Variable name is required.")
    .max(100, "Variable name must be 100 characters or fewer.")
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_]*$/,
      "Must start with a letter and contain only letters, numbers, and underscores."
    ),
  label: z.string().trim().min(1, "Label is required.").max(255),
  description: z.string().trim().max(500).optional().nullable(),
  category: z.string().trim().min(1, "Category is required.").max(100),
  sampleValue: z.string().trim().max(500).optional().nullable(),
});

export type CreateEmailTemplateVariableInput = z.infer<typeof createEmailTemplateVariableSchema>;
