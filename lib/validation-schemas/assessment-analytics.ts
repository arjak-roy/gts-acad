import { z } from "zod";

export const assessmentAnalyticsFiltersSchema = z.object({
  assessmentPoolId: z.string().trim().min(1).optional(),
  batchId: z.string().trim().min(1).optional(),
  courseId: z.string().trim().min(1).optional(),
  programId: z.string().trim().min(1).optional(),
  programType: z.string().trim().min(1).optional(),
  learnerId: z.string().trim().min(1).optional(),
  status: z.enum(["ALL", "GRADED", "PENDING_REVIEW", "IN_REVIEW"]).default("ALL"),
  questionType: z.string().trim().min(1).optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
});

export type AssessmentAnalyticsFilters = z.infer<typeof assessmentAnalyticsFiltersSchema>;

export const assessmentSummaryRequestSchema = assessmentAnalyticsFiltersSchema;

export const learnerPerformanceRequestSchema = assessmentAnalyticsFiltersSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["learnerName", "latestScore", "highestScore", "attemptCount", "completionDate"]).default("learnerName"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export type LearnerPerformanceRequest = z.infer<typeof learnerPerformanceRequestSchema>;

export const questionAnalyticsRequestSchema = assessmentAnalyticsFiltersSchema.extend({
  assessmentPoolId: z.string().trim().min(1, "Assessment pool is required for question analytics."),
  lowSuccessThreshold: z.coerce.number().int().min(0).max(100).default(50),
});

export type QuestionAnalyticsRequest = z.infer<typeof questionAnalyticsRequestSchema>;

export const trendAnalysisRequestSchema = assessmentAnalyticsFiltersSchema.extend({
  granularity: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
});

export type TrendAnalysisRequest = z.infer<typeof trendAnalysisRequestSchema>;

export const learnerComparisonRequestSchema = z.object({
  learnerIds: z.array(z.string().trim().min(1)).min(2).max(10),
  assessmentPoolId: z.string().trim().min(1).optional(),
  batchId: z.string().trim().min(1).optional(),
});

export type LearnerComparisonRequest = z.infer<typeof learnerComparisonRequestSchema>;

export const retakeGrantRequestSchema = z.object({
  assessmentPoolId: z.string().trim().min(1, "Assessment pool is required."),
  learnerId: z.string().trim().min(1, "Learner is required."),
  batchId: z.string().trim().min(1, "Batch is required."),
  reason: z.string().trim().max(1000).optional(),
  expiresAt: z.string().trim().min(1).optional(),
});

export type RetakeGrantRequest = z.infer<typeof retakeGrantRequestSchema>;

export const exportRequestSchema = assessmentAnalyticsFiltersSchema.extend({
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
  reportType: z.enum(["summary", "learner-performance", "question-analytics"]),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;
