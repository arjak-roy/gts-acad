import { z } from "zod";

export const assignContentToBatchSchema = z.object({
  batchId: z.string().trim().min(1, "Batch is required."),
  contentIds: z.array(z.string().trim().min(1)).min(1, "At least one content item is required."),
});

export const removeContentFromBatchSchema = z.object({
  batchId: z.string().trim().min(1, "Batch is required."),
  contentId: z.string().trim().min(1, "Content item is required."),
});

export const assignAssessmentToBatchSchema = z.object({
  batchId: z.string().trim().min(1, "Batch is required."),
  assessmentPoolIds: z.array(z.string().trim().min(1)).min(1, "At least one assessment is required."),
  scheduledAt: z.coerce.date().optional().nullable(),
});

export const removeAssessmentFromBatchSchema = z.object({
  batchId: z.string().trim().min(1, "Batch is required."),
  assessmentPoolId: z.string().trim().min(1, "Assessment pool is required."),
});

export type AssignContentToBatchInput = z.infer<typeof assignContentToBatchSchema>;
export type RemoveContentFromBatchInput = z.infer<typeof removeContentFromBatchSchema>;
export type AssignAssessmentToBatchInput = z.infer<typeof assignAssessmentToBatchSchema>;
export type RemoveAssessmentFromBatchInput = z.infer<typeof removeAssessmentFromBatchSchema>;
