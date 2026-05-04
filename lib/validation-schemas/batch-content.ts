import { z } from "zod";

export const assignContentToBatchSchema = z.object({
  batchId: z.string().trim().min(1, "Batch is required."),
  contentIds: z.array(z.string().trim().min(1)).optional().default([]),
  resourceIds: z.array(z.string().trim().min(1)).optional().default([]),
}).superRefine((value, context) => {
  if (value.contentIds.length === 0 && value.resourceIds.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select at least one course content item or repository resource.",
      path: ["contentIds"],
    });
  }

  if (value.contentIds.length > 0 && value.resourceIds.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choose either direct content mappings or repository resources, not both in the same request.",
      path: ["resourceIds"],
    });
  }
});

export const removeContentFromBatchSchema = z.object({
  batchId: z.string().trim().min(1, "Batch is required."),
  contentId: z.string().trim().min(1).optional().nullable(),
  resourceId: z.string().trim().min(1).optional().nullable(),
  assignmentId: z.string().trim().min(1).optional().nullable(),
}).superRefine((value, context) => {
  const hasLegacyContentRemoval = Boolean(value.contentId);
  const hasResourceRemoval = Boolean(value.resourceId && value.assignmentId);

  if (!hasLegacyContentRemoval && !hasResourceRemoval) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide either a contentId or both resourceId and assignmentId.",
      path: ["contentId"],
    });
  }

  if (hasLegacyContentRemoval && hasResourceRemoval) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Remove either a direct content mapping or a repository resource assignment, not both.",
      path: ["resourceId"],
    });
  }
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
