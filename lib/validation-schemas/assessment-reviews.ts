import { z } from "zod";

export const assessmentReviewQueueStatusSchema = z.enum(["ALL", "PENDING_REVIEW", "IN_REVIEW", "GRADED"]);

export const trainerAssessmentAssignmentSchema = z.object({
  assessmentPoolId: z.string().trim().min(1, "Assessment pool is required."),
  canReviewSubmissions: z.coerce.boolean().optional().default(false),
  canManageAttempts: z.coerce.boolean().optional().default(false),
  canManualGrade: z.coerce.boolean().optional().default(false),
  notes: z.string().trim().max(1000).optional().default(""),
}).superRefine((value, context) => {
  if (!value.canReviewSubmissions && !value.canManageAttempts && !value.canManualGrade) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select at least one trainer assessment responsibility.",
      path: ["canReviewSubmissions"],
    });
  }
});

export const replaceTrainerAssessmentAssignmentsSchema = z.object({
  assignments: z.array(trainerAssessmentAssignmentSchema).default([]),
});

export const listAssessmentReviewQueueSchema = z.object({
  search: z.string().trim().max(100).optional().default(""),
  status: assessmentReviewQueueStatusSchema.default("ALL"),
});

export const assessmentAttemptIdSchema = z.object({
  attemptId: z.string().trim().min(1, "Assessment attempt is required."),
});

export const updateAssessmentAttemptStatusSchema = z.object({
  status: z.enum(["PENDING_REVIEW", "IN_REVIEW"]),
});

export const gradeAssessmentAttemptSchema = z.object({
  reviewerFeedback: z.string().trim().max(2000).optional().default(""),
  questionScores: z.array(z.object({
    questionId: z.string().trim().min(1, "Question is required."),
    marksAwarded: z.coerce.number().int().min(0, "Marks cannot be negative."),
    feedback: z.string().trim().max(1000).optional().default(""),
  })).min(1, "At least one graded question is required."),
});

export type TrainerAssessmentAssignmentInput = z.infer<typeof trainerAssessmentAssignmentSchema>;
export type ReplaceTrainerAssessmentAssignmentsInput = z.infer<typeof replaceTrainerAssessmentAssignmentsSchema>;
export type ListAssessmentReviewQueueInput = z.infer<typeof listAssessmentReviewQueueSchema>;
export type UpdateAssessmentAttemptStatusInput = z.infer<typeof updateAssessmentAttemptStatusSchema>;
export type GradeAssessmentAttemptInput = z.infer<typeof gradeAssessmentAttemptSchema>;