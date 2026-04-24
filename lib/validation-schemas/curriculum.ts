import { z } from "zod";

export const curriculumStatusEnum = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const curriculumItemTypeEnum = z.enum(["CONTENT", "ASSESSMENT"]);
export const curriculumItemReleaseTypeEnum = z.enum([
  "IMMEDIATE",
  "ABSOLUTE_DATE",
  "BATCH_RELATIVE",
  "PREVIOUS_ITEM_COMPLETION",
  "PREVIOUS_ITEM_SCORE",
  "MANUAL",
]);

const curriculumStageItemReleaseConfigSchema = z.object({
  releaseType: curriculumItemReleaseTypeEnum,
  releaseAt: z.coerce.date().optional().nullable(),
  releaseOffsetDays: z.coerce.number().int().min(0).max(3650).optional().nullable(),
  prerequisiteStageItemId: z.string().trim().min(1).optional().nullable(),
  minimumScorePercent: z.coerce.number().int().min(0).max(100).optional().nullable(),
  estimatedDurationMinutes: z.coerce.number().int().min(1).max(10080).optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  dueOffsetDays: z.coerce.number().int().min(0).max(3650).optional().nullable(),
}).superRefine((value, context) => {
  if (value.releaseType === "ABSOLUTE_DATE" && !value.releaseAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["releaseAt"],
      message: "A release date is required for absolute-date release rules.",
    });
  }

  if (value.releaseType === "BATCH_RELATIVE" && typeof value.releaseOffsetDays !== "number") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["releaseOffsetDays"],
      message: "A batch-relative day offset is required for batch-relative release rules.",
    });
  }

  if (value.releaseType === "PREVIOUS_ITEM_SCORE" && typeof value.minimumScorePercent !== "number") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["minimumScorePercent"],
      message: "A minimum passing score is required for score-based release rules.",
    });
  }

  if (value.dueAt && typeof value.dueOffsetDays === "number") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dueOffsetDays"],
      message: "Choose either an absolute due date or a batch-relative due offset, not both.",
    });
  }
});

export const createCurriculumSchema = z.object({
  courseId: z.string().trim().min(1, "Course is required."),
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(255),
  description: z.string().trim().max(2000).optional().default(""),
});

export const curriculumIdSchema = z.object({
  curriculumId: z.string().trim().min(1, "Curriculum ID is required."),
});

export const updateCurriculumSchema = z.object({
  curriculumId: z.string().trim().min(1),
  title: z.string().trim().min(2).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
  status: curriculumStatusEnum.optional(),
});

export const curriculumCompletionRuleEnum = z.enum(["ALL_REQUIRED", "ALL_ITEMS", "PERCENTAGE", "MIN_ITEMS"]);

export const createCurriculumModuleSchema = z.object({
  curriculumId: z.string().trim().min(1, "Curriculum ID is required."),
  title: z.string().trim().min(2, "Module title must be at least 2 characters.").max(255),
  description: z.string().trim().max(2000).optional().default(""),
  completionRule: curriculumCompletionRuleEnum.optional(),
  completionThreshold: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  prerequisiteModuleId: z.string().trim().min(1).optional().nullable(),
});

export const moduleIdSchema = z.object({
  moduleId: z.string().trim().min(1, "Module ID is required."),
});

export const updateCurriculumModuleSchema = z.object({
  moduleId: z.string().trim().min(1),
  title: z.string().trim().min(2).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
  completionRule: curriculumCompletionRuleEnum.optional(),
  completionThreshold: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  prerequisiteModuleId: z.string().trim().min(1).optional().nullable(),
});

export const reorderCurriculumModulesSchema = z.object({
  curriculumId: z.string().trim().min(1, "Curriculum ID is required."),
  moduleIds: z.array(z.string().trim().min(1)).min(1, "At least one module is required."),
});

export const createCurriculumStageSchema = z.object({
  moduleId: z.string().trim().min(1, "Module ID is required."),
  title: z.string().trim().min(2, "Stage title must be at least 2 characters.").max(255),
  description: z.string().trim().max(2000).optional().default(""),
  completionRule: curriculumCompletionRuleEnum.optional(),
  completionThreshold: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  prerequisiteStageId: z.string().trim().min(1).optional().nullable(),
});

export const stageIdSchema = z.object({
  stageId: z.string().trim().min(1, "Stage ID is required."),
});

export const updateCurriculumStageSchema = z.object({
  stageId: z.string().trim().min(1),
  title: z.string().trim().min(2).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
  completionRule: curriculumCompletionRuleEnum.optional(),
  completionThreshold: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  prerequisiteStageId: z.string().trim().min(1).optional().nullable(),
});

export const reorderCurriculumStagesSchema = z.object({
  moduleId: z.string().trim().min(1, "Module ID is required."),
  stageIds: z.array(z.string().trim().min(1)).min(1, "At least one stage is required."),
});

export const createCurriculumStageItemSchema = z.object({
  stageId: z.string().trim().min(1, "Stage ID is required."),
  itemType: curriculumItemTypeEnum,
  contentId: z.string().trim().min(1).optional().nullable(),
  assessmentPoolId: z.string().trim().min(1).optional().nullable(),
  isRequired: z.coerce.boolean().optional().default(false),
  releaseConfig: curriculumStageItemReleaseConfigSchema.optional(),
}).superRefine((value, context) => {
  if (value.itemType === "CONTENT") {
    if (!value.contentId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentId"],
        message: "Content is required for content items.",
      });
    }

    if (value.assessmentPoolId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assessmentPoolId"],
        message: "Assessment cannot be provided for content items.",
      });
    }
  }

  if (value.itemType === "ASSESSMENT") {
    if (!value.assessmentPoolId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assessmentPoolId"],
        message: "Assessment is required for assessment items.",
      });
    }

    if (value.contentId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentId"],
        message: "Content cannot be provided for assessment items.",
      });
    }
  }
});

export const createCurriculumStageItemsSchema = z.object({
  stageId: z.string().trim().min(1, "Stage ID is required."),
  itemType: curriculumItemTypeEnum,
  contentIds: z.array(z.string().trim().min(1)).optional().default([]),
  assessmentPoolIds: z.array(z.string().trim().min(1)).optional().default([]),
  isRequired: z.coerce.boolean().optional().default(false),
  releaseConfig: curriculumStageItemReleaseConfigSchema.optional(),
}).superRefine((value, context) => {
  if (value.itemType === "CONTENT") {
    if (value.contentIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentIds"],
        message: "Select at least one content item.",
      });
    }

    if (value.assessmentPoolIds.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assessmentPoolIds"],
        message: "Assessment selections cannot be provided for content items.",
      });
    }
  }

  if (value.itemType === "ASSESSMENT") {
    if (value.assessmentPoolIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assessmentPoolIds"],
        message: "Select at least one assessment.",
      });
    }

    if (value.contentIds.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentIds"],
        message: "Content selections cannot be provided for assessment items.",
      });
    }
  }
});

export const stageItemIdSchema = z.object({
  itemId: z.string().trim().min(1, "Item ID is required."),
});

export const updateCurriculumStageItemSchema = z.object({
  itemId: z.string().trim().min(1),
  isRequired: z.coerce.boolean().optional(),
  releaseConfig: curriculumStageItemReleaseConfigSchema.optional(),
});

export const reorderCurriculumStageItemsSchema = z.object({
  stageId: z.string().trim().min(1, "Stage ID is required."),
  itemIds: z.array(z.string().trim().min(1)).min(1, "At least one item is required."),
});

export const assignCurriculumToBatchSchema = z.object({
  curriculumId: z.string().trim().min(1, "Curriculum ID is required."),
  batchId: z.string().trim().min(1, "Batch ID is required."),
});

export const removeCurriculumFromBatchSchema = assignCurriculumToBatchSchema;

export const releaseCurriculumStageItemForBatchSchema = z.object({
  batchId: z.string().trim().min(1, "Batch ID is required."),
  itemId: z.string().trim().min(1, "Item ID is required."),
  note: z.string().trim().max(500).optional().default(""),
});

export const revokeCurriculumStageItemReleaseForBatchSchema = z.object({
  batchId: z.string().trim().min(1, "Batch ID is required."),
  itemId: z.string().trim().min(1, "Item ID is required."),
});

export type CreateCurriculumInput = z.infer<typeof createCurriculumSchema>;
export type UpdateCurriculumInput = z.infer<typeof updateCurriculumSchema>;
export type CreateCurriculumModuleInput = z.infer<typeof createCurriculumModuleSchema>;
export type UpdateCurriculumModuleInput = z.infer<typeof updateCurriculumModuleSchema>;
export type ReorderCurriculumModulesInput = z.infer<typeof reorderCurriculumModulesSchema>;
export type CreateCurriculumStageInput = z.infer<typeof createCurriculumStageSchema>;
export type UpdateCurriculumStageInput = z.infer<typeof updateCurriculumStageSchema>;
export type ReorderCurriculumStagesInput = z.infer<typeof reorderCurriculumStagesSchema>;
export type CreateCurriculumStageItemInput = z.infer<typeof createCurriculumStageItemSchema>;
export type CreateCurriculumStageItemsInput = z.infer<typeof createCurriculumStageItemsSchema>;
export type UpdateCurriculumStageItemInput = z.infer<typeof updateCurriculumStageItemSchema>;
export type ReorderCurriculumStageItemsInput = z.infer<typeof reorderCurriculumStageItemsSchema>;
export type AssignCurriculumToBatchInput = z.infer<typeof assignCurriculumToBatchSchema>;
export type RemoveCurriculumFromBatchInput = z.infer<typeof removeCurriculumFromBatchSchema>;
export type ReleaseCurriculumStageItemForBatchInput = z.infer<typeof releaseCurriculumStageItemForBatchSchema>;
export type RevokeCurriculumStageItemReleaseForBatchInput = z.infer<typeof revokeCurriculumStageItemReleaseForBatchSchema>;

export const cloneCurriculumSchema = z.object({
  sourceCurriculumId: z.string().trim().min(1, "Source curriculum ID is required."),
  targetCourseId: z.string().trim().min(1, "Target course ID is required."),
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(255),
});

export const saveCurriculumAsTemplateSchema = z.object({
  curriculumId: z.string().trim().min(1, "Curriculum ID is required."),
});

export const createCurriculumFromTemplateSchema = z.object({
  templateCurriculumId: z.string().trim().min(1, "Template curriculum ID is required."),
  targetCourseId: z.string().trim().min(1, "Target course ID is required."),
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(255),
});

export type CloneCurriculumInput = z.infer<typeof cloneCurriculumSchema>;
export type SaveCurriculumAsTemplateInput = z.infer<typeof saveCurriculumAsTemplateSchema>;
export type CreateCurriculumFromTemplateInput = z.infer<typeof createCurriculumFromTemplateSchema>;