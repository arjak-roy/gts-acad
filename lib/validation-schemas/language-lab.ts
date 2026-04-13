import { z } from "zod";

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
  isActive: booleanishSchema.optional(),
  courseIds: z.array(z.string().trim().min(1)).max(200).optional(),
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
export type LanguageLabAnalyticsFiltersInput = z.infer<typeof languageLabAnalyticsFiltersSchema>;
export type CreateLanguageLabWordInput = z.infer<typeof createLanguageLabWordSchema>;
export type UpdateLanguageLabWordInput = z.infer<typeof updateLanguageLabWordSchema>;
export type CreatePronunciationAttemptInput = z.infer<typeof createPronunciationAttemptSchema>;
export type CreateRoleplaySummaryInput = z.infer<typeof createRoleplaySummarySchema>;