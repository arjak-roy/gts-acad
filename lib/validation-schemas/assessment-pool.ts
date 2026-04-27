import { z } from "zod";

import { QUESTION_TYPE_VALUES } from "@/lib/question-types";

export const questionTypeEnum = z.enum(QUESTION_TYPE_VALUES);

export const difficultyLevelEnum = z.enum(["EASY", "MEDIUM", "HARD"]);
export const assessmentPoolStatusEnum = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const passCriteriaConfigSchema = z.object({
  minPercentageScore: z.coerce.number().min(0).max(100).optional(),
  minMarks: z.coerce.number().int().min(0).optional(),
  mandatoryQuestionIds: z.array(z.string().trim().min(1)).optional().default([]),
  minCompletionRequirement: z.coerce.number().min(0).max(100).optional(),
}).optional().nullable();

export const createAssessmentPoolSchema = z.object({
  code: z.string().trim().max(50).optional().default(""),
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(255),
  description: z.string().trim().max(2000).optional().default(""),
  questionType: questionTypeEnum,
  difficultyLevel: difficultyLevelEnum.optional().default("MEDIUM"),
  totalMarks: z.coerce.number().int().positive().optional().default(100),
  passingMarks: z.coerce.number().int().nonnegative().optional().default(40),
  passCriteriaConfig: passCriteriaConfigSchema,
  timeLimitMinutes: z.coerce.number().int().positive().optional().nullable(),
  shuffleQuestions: z.coerce.boolean().optional().default(false),
  shuffleOptions: z.coerce.boolean().optional().default(false),
  randomSubsetCount: z.coerce.number().int().positive().optional().nullable(),
});

export const assessmentPoolIdSchema = z.object({
  poolId: z.string().trim().min(1, "Assessment pool ID is required."),
});

export const updateAssessmentPoolSchema = z.object({
  poolId: z.string().trim().min(1),
  title: z.string().trim().min(2).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
  questionType: questionTypeEnum.optional(),
  difficultyLevel: difficultyLevelEnum.optional(),
  totalMarks: z.coerce.number().int().positive().optional(),
  passingMarks: z.coerce.number().int().nonnegative().optional(),
  passCriteriaConfig: passCriteriaConfigSchema,
  timeLimitMinutes: z.coerce.number().int().positive().optional().nullable(),
  status: assessmentPoolStatusEnum.optional(),
  shuffleQuestions: z.coerce.boolean().optional(),
  shuffleOptions: z.coerce.boolean().optional(),
  randomSubsetCount: z.coerce.number().int().positive().optional().nullable(),
});

export const createQuestionSchema = z.object({
  assessmentPoolId: z.string().trim().min(1),
  questionText: z.string().trim().min(1, "Question text is required."),
  questionType: questionTypeEnum,
  difficultyLevel: difficultyLevelEnum.optional().nullable(),
  options: z.any().optional().default(null),
  correctAnswer: z.any().optional().default(null),
  explanation: z.string().trim().max(2000).optional().default(""),
  marks: z.coerce.number().int().positive().optional().default(1),
  isMandatory: z.coerce.boolean().optional().default(false),
  sortOrder: z.coerce.number().int().nonnegative().optional().default(0),
  sectionId: z.string().trim().optional().nullable(),
});

export const questionIdSchema = z.object({
  questionId: z.string().trim().min(1, "Question ID is required."),
});

export const updateQuestionSchema = z.object({
  questionId: z.string().trim().min(1),
  questionText: z.string().trim().min(1).optional(),
  questionType: questionTypeEnum.optional(),
  difficultyLevel: difficultyLevelEnum.optional().nullable(),
  options: z.any().optional(),
  correctAnswer: z.any().optional(),
  explanation: z.string().trim().max(2000).optional(),
  marks: z.coerce.number().int().positive().optional(),
  isMandatory: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
  sectionId: z.string().trim().optional().nullable(),
});

export const linkAssessmentToCourseSchema = z.object({
  courseId: z.string().trim().min(1, "Course is required."),
  assessmentPoolId: z.string().trim().min(1, "Assessment pool is required."),
  sortOrder: z.coerce.number().int().nonnegative().optional().default(0),
  isRequired: z.coerce.boolean().optional().default(false),
});

export const gradeSubmissionSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().trim().min(1),
      answer: z.unknown(),
    }),
  ),
});

export const saveAssessmentDraftSchema = gradeSubmissionSchema;

export type CreateAssessmentPoolInput = z.infer<typeof createAssessmentPoolSchema>;
export type UpdateAssessmentPoolInput = z.infer<typeof updateAssessmentPoolSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type LinkAssessmentToCourseInput = z.infer<typeof linkAssessmentToCourseSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
export type SaveAssessmentDraftInput = z.infer<typeof saveAssessmentDraftSchema>;
