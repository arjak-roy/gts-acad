import { z } from "zod";

const questionTypeEnum = z.enum([
  "MCQ",
  "NUMERIC",
  "ESSAY",
  "FILL_IN_THE_BLANK",
  "MULTI_INPUT_REASONING",
  "TWO_PART_ANALYSIS",
]);

const difficultyLevelEnum = z.enum(["EASY", "MEDIUM", "HARD"]);

/** Schema for AI question generation preview request. */
export const aiGeneratePreviewSchema = z.object({
  prompt: z.string().trim().min(10, "Prompt must be at least 10 characters.").max(2000),
  questionType: questionTypeEnum,
  questionTypes: z.array(questionTypeEnum).optional(),
  questionCount: z.coerce.number().int().min(1).max(50).default(5),
  difficultyLevel: difficultyLevelEnum.default("MEDIUM"),
  courseId: z.string().trim().optional(),
});

/** Schema for a single AI-generated question in the create request. */
const aiGeneratedQuestionSchema = z.object({
  questionText: z.string().trim().min(1),
  questionType: z.string().trim().min(1),
  options: z.any().nullable().default(null),
  correctAnswer: z.any().nullable().default(null),
  explanation: z.string().default(""),
  marks: z.coerce.number().int().min(1).default(1),
});

/** Schema for creating an AI assessment pool with pre-generated questions. */
export const aiCreateAssessmentSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(255),
  description: z.string().trim().max(2000).optional(),
  prompt: z.string().trim().min(10),
  questionType: questionTypeEnum,
  difficultyLevel: difficultyLevelEnum,
  totalMarks: z.coerce.number().int().positive().default(100),
  passingMarks: z.coerce.number().int().nonnegative().default(40),
  timeLimitMinutes: z.coerce.number().int().positive().optional().nullable(),
  courseId: z.string().trim().optional(),
  questions: z.array(aiGeneratedQuestionSchema).min(1, "At least one question is required."),
});

/** Wrapper schema that dispatches by mode. */
export const aiGenerateRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("preview") }).merge(aiGeneratePreviewSchema),
  z.object({ mode: z.literal("create") }).merge(aiCreateAssessmentSchema),
]);

export type AiGeneratePreviewInput = z.infer<typeof aiGeneratePreviewSchema>;
export type AiCreateAssessmentInput = z.infer<typeof aiCreateAssessmentSchema>;
