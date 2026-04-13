import { z } from "zod";

import { LANGUAGE_LAB_VOCAB_IMPORT_MAX_ROWS } from "@/lib/language-lab/vocab-bank";

const booleanishSchema = z.union([z.boolean(), z.string(), z.number()]).transform((value, context) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off", ""].includes(normalized)) {
    return false;
  }

  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Expected boolean value.",
  });

  return z.NEVER;
});

const metadataSchema = z.record(z.string(), z.unknown()).optional().default({});

function parseRequiredCsvString(
  value: unknown,
  context: z.RefinementCtx,
  options: { label: string; maxLength: number },
) {
  const normalized = typeof value === "string" ? value.trim() : String(value ?? "").trim();

  if (!normalized) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${options.label} is required.`,
    });

    return z.NEVER;
  }

  if (normalized.length > options.maxLength) {
    context.addIssue({
      code: z.ZodIssueCode.too_big,
      maximum: options.maxLength,
      type: "string",
      inclusive: true,
      message: `${options.label} must be ${options.maxLength} characters or fewer.`,
    });

    return z.NEVER;
  }

  return normalized;
}

function parseOptionalCsvString(value: unknown, context: z.RefinementCtx, maxLength: number, fallback = "") {
  const normalized = typeof value === "string" ? value.trim() : String(value ?? "").trim();

  if (!normalized) {
    return fallback;
  }

  if (normalized.length > maxLength) {
    context.addIssue({
      code: z.ZodIssueCode.too_big,
      maximum: maxLength,
      type: "string",
      inclusive: true,
      message: `Value must be ${maxLength} characters or fewer.`,
    });

    return z.NEVER;
  }

  return normalized;
}

function parseOptionalCsvDifficulty(value: unknown, context: z.RefinementCtx) {
  const normalized = typeof value === "string" ? value.trim() : String(value ?? "").trim();

  if (!normalized) {
    return 1;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Difficulty must be an integer between 1 and 5.",
    });

    return z.NEVER;
  }

  return parsed;
}

function parseOptionalCsvIsActive(value: unknown, context: z.RefinementCtx) {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === "string" && value.trim().length === 0) {
    return true;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "isActive must be a boolean value.",
  });

  return z.NEVER;
}

const phonemeFeedbackSchema = z.object({
  phoneme: z.string().trim().min(1).max(64),
  status: z.enum(["correct", "incorrect", "partial"]),
  observed: z.string().trim().max(255).optional().default(""),
  lipShape: z.string().trim().max(1000).optional().default(""),
  tip: z.string().trim().max(1000).optional().default(""),
  startMs: z.coerce.number().int().min(0).max(3_600_000).optional().default(0),
  endMs: z.coerce.number().int().min(0).max(3_600_000).optional().default(0),
});

const roleplayTransactionSchema = z.object({
  action: z.string().trim().min(1).max(50),
  item: z.string().trim().max(255).optional().default(""),
  itemPrice: z.coerce.number().min(0).max(1000).optional().default(0),
  quantity: z.coerce.number().int().min(1).max(100).optional().default(1),
  totalPrice: z.coerce.number().min(0).max(1000).optional().default(0),
  shopkeeperResponse: z.string().trim().max(4000).optional().default(""),
  englishTranslation: z.string().trim().max(4000).optional().default(""),
  dealAccepted: booleanishSchema.optional().default(false),
});

export const languageLabWordIdSchema = z.object({
  wordId: z.string().trim().min(1, "Word ID is required."),
});

export const listLanguageLabWordsSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  isActive: booleanishSchema.optional(),
});

export const buddyPersonaIdSchema = z.object({
  personaId: z.string().trim().min(1, "Buddy persona ID is required."),
});

export const listBuddyPersonasSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  isActive: booleanishSchema.optional(),
});

export const createBuddyPersonaSchema = z.object({
  name: z.string().trim().min(1, "Persona name is required.").max(160),
  description: z.string().trim().max(4000).optional().default(""),
  language: z.string().trim().min(1, "Conversation language is required.").max(80),
  languageCode: z.string().trim().min(1, "Language code is required.").max(20),
  systemPrompt: z.string().trim().max(12_000).optional().default(""),
  welcomeMessage: z.string().trim().max(2000).optional().default(""),
  supportsTables: booleanishSchema.optional().default(true),
  supportsEmailActions: booleanishSchema.optional().default(false),
  supportsSpeech: booleanishSchema.optional().default(true),
  isActive: booleanishSchema.optional().default(true),
  courseIds: z.array(z.string().trim().min(1)).max(200).optional().default([]),
});

export const updateBuddyPersonaSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  language: z.string().trim().min(1).max(80).optional(),
  languageCode: z.string().trim().min(1).max(20).optional(),
  systemPrompt: z.string().trim().max(12_000).optional(),
  welcomeMessage: z.string().trim().max(2000).optional(),
  supportsTables: booleanishSchema.optional(),
  supportsEmailActions: booleanishSchema.optional(),
  supportsSpeech: booleanishSchema.optional(),
  isActive: booleanishSchema.optional(),
  courseIds: z.array(z.string().trim().min(1)).max(200).optional(),
});

const buddyEmailActionTargetSchema = z.enum(["ACADEMY_SUPPORT", "TRAINER"]);

export const requestBuddyEmailActionSchema = z.object({
  batchId: z.string().trim().min(1, "Batch ID is required."),
  target: buddyEmailActionTargetSchema,
  subject: z.string().trim().min(3, "Email subject is required.").max(160),
  message: z.string().trim().min(10, "Email message is required.").max(4000),
});

export const languageLabAnalyticsFiltersSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  batchId: z.string().trim().min(1).optional(),
  learnerId: z.string().trim().min(1).optional(),
});

export const createLanguageLabWordSchema = z.object({
  word: z.string().trim().min(1, "Word is required.").max(255),
  englishMeaning: z.string().trim().max(255).optional().default(""),
  phonetic: z.string().trim().max(255).optional().default(""),
  difficulty: z.coerce.number().int().min(1).max(5).optional().default(1),
  source: z.string().trim().min(1).max(50).optional().default("manual"),
  isActive: booleanishSchema.optional().default(true),
});

export const updateLanguageLabWordSchema = z.object({
  word: z.string().trim().min(1).max(255).optional(),
  englishMeaning: z.string().trim().max(255).optional(),
  phonetic: z.string().trim().max(255).optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  source: z.string().trim().min(1).max(50).optional(),
  isActive: booleanishSchema.optional(),
});

export const languageLabVocabImportRowSchema = z.object({
  rowNumber: z.coerce.number().int().min(2),
  word: z.unknown().transform((value, context) => parseRequiredCsvString(value, context, { label: "Word", maxLength: 255 })),
  englishMeaning: z.unknown().transform((value, context) => parseOptionalCsvString(value, context, 255)),
  phonetic: z.unknown().transform((value, context) => parseOptionalCsvString(value, context, 255)),
  difficulty: z.unknown().transform((value, context) => parseOptionalCsvDifficulty(value, context)),
  source: z.unknown().transform((value, context) => parseOptionalCsvString(value, context, 50, "bulk_upload")),
  isActive: z.unknown().transform((value, context) => parseOptionalCsvIsActive(value, context)),
});

export const commitLanguageLabVocabImportSchema = z.object({
  fileName: z.string().trim().max(255).optional().default(""),
  rows: z
    .array(languageLabVocabImportRowSchema)
    .min(1, "Preview at least one valid row before importing.")
    .max(LANGUAGE_LAB_VOCAB_IMPORT_MAX_ROWS, `Upload at most ${LANGUAGE_LAB_VOCAB_IMPORT_MAX_ROWS} rows at a time.`),
});

export const createPronunciationAttemptSchema = z.object({
  batchId: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).max(80).optional().default("pronunciation_lesson"),
  modelId: z.string().trim().max(120).optional().default(""),
  targetWord: z.string().trim().min(1, "Target word is required.").max(255),
  targetEnglish: z.string().trim().max(255).optional().default(""),
  targetPhonetic: z.string().trim().max(255).optional().default(""),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  overallScore: z.coerce.number().int().min(0).max(100),
  heardText: z.string().trim().max(4000).optional().default(""),
  strengths: z.array(z.string().trim().min(1).max(300)).max(20).optional().default([]),
  priorities: z.array(z.string().trim().min(1).max(300)).max(20).optional().default([]),
  nextTryInstruction: z.string().trim().max(2000).optional().default(""),
  phonemeBreakdown: z.array(phonemeFeedbackSchema).max(128).optional().default([]),
  metadata: metadataSchema,
});

export const createRoleplaySummarySchema = z.object({
  batchId: z.string().trim().min(1).optional(),
  scenarioName: z.string().trim().min(1).max(255).optional().default("Bread Shop"),
  occurredAt: z.string().datetime().optional(),
  modelId: z.string().trim().max(120).optional().default(""),
  budgetEur: z.coerce.number().min(0).max(1000),
  totalSpentEur: z.coerce.number().min(0).max(1000),
  bagItems: z.array(z.string().trim().min(1).max(255)).max(100).optional().default([]),
  dealComplete: booleanishSchema.optional().default(false),
  missionFailed: booleanishSchema.optional().default(false),
  finalMessage: z.string().trim().max(4000).optional().default(""),
  conversationHistory: z.array(z.record(z.string(), z.unknown())).max(200).optional().default([]),
  transactions: z.array(roleplayTransactionSchema).max(200).optional().default([]),
  metadata: metadataSchema,
});

export type ListLanguageLabWordsInput = z.infer<typeof listLanguageLabWordsSchema>;
export type ListBuddyPersonasInput = z.infer<typeof listBuddyPersonasSchema>;
export type CreateBuddyPersonaInput = z.infer<typeof createBuddyPersonaSchema>;
export type UpdateBuddyPersonaInput = z.infer<typeof updateBuddyPersonaSchema>;
export type RequestBuddyEmailActionInput = z.infer<typeof requestBuddyEmailActionSchema>;
export type LanguageLabAnalyticsFiltersInput = z.infer<typeof languageLabAnalyticsFiltersSchema>;
export type CreateLanguageLabWordInput = z.infer<typeof createLanguageLabWordSchema>;
export type UpdateLanguageLabWordInput = z.infer<typeof updateLanguageLabWordSchema>;
export type LanguageLabVocabImportRowInput = z.infer<typeof languageLabVocabImportRowSchema>;
export type CommitLanguageLabVocabImportInput = z.infer<typeof commitLanguageLabVocabImportSchema>;
export type CreatePronunciationAttemptInput = z.infer<typeof createPronunciationAttemptSchema>;
export type CreateRoleplaySummaryInput = z.infer<typeof createRoleplaySummarySchema>;