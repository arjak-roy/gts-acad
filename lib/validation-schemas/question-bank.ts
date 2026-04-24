import { z } from "zod";

import { questionTypeEnum, difficultyLevelEnum } from "@/lib/validation-schemas/assessment-pool";

const questionBankTagsSchema = z.array(z.string().trim().min(1).max(32)).max(12).optional().default([]);

export const questionBankQuestionIdSchema = z.object({
  questionId: z.string().trim().min(1, "Question ID is required."),
});

export const createQuestionBankQuestionSchema = z.object({
  courseId: z.string().trim().optional().default(""),
  questionText: z.string().trim().min(1, "Question text is required."),
  questionType: questionTypeEnum,
  difficultyLevel: difficultyLevelEnum.optional().nullable(),
  options: z.any().optional().default(null),
  correctAnswer: z.any().optional().default(null),
  explanation: z.string().trim().max(2000).optional().default(""),
  tags: questionBankTagsSchema,
  marks: z.coerce.number().int().positive().optional().default(1),
});

export const updateQuestionBankQuestionSchema = z.object({
  questionId: z.string().trim().min(1),
  courseId: z.string().trim().optional(),
  questionText: z.string().trim().min(1).optional(),
  questionType: questionTypeEnum.optional(),
  difficultyLevel: difficultyLevelEnum.optional().nullable(),
  options: z.any().optional(),
  correctAnswer: z.any().optional(),
  explanation: z.string().trim().max(2000).optional(),
  tags: questionBankTagsSchema,
  marks: z.coerce.number().int().positive().optional(),
});

export const bulkDeleteQuestionBankQuestionsSchema = z.object({
  questionIds: z.array(z.string().trim().min(1, "Question ID is required.")).min(1, "Select at least one question."),
});

export const importQuestionBankQuestionsSchema = z.object({
  assessmentPoolId: z.string().trim().min(1, "Assessment pool ID is required."),
  questionIds: z.array(z.string().trim().min(1, "Question ID is required.")).min(1, "Select at least one question."),
});

export const duplicateAssessmentQuestionsToBankSchema = z.object({
  assessmentPoolId: z.string().trim().min(1, "Assessment pool ID is required."),
  questionIds: z.array(z.string().trim().min(1, "Question ID is required.")).min(1, "Select at least one question."),
  courseId: z.string().trim().optional().default(""),
  tags: questionBankTagsSchema,
});

export type CreateQuestionBankQuestionInput = z.infer<typeof createQuestionBankQuestionSchema>;
export type UpdateQuestionBankQuestionInput = z.infer<typeof updateQuestionBankQuestionSchema>;
export type BulkDeleteQuestionBankQuestionsInput = z.infer<typeof bulkDeleteQuestionBankQuestionsSchema>;
export type ImportQuestionBankQuestionsInput = z.infer<typeof importQuestionBankQuestionsSchema>;
export type DuplicateAssessmentQuestionsToBankInput = z.infer<typeof duplicateAssessmentQuestionsToBankSchema>;