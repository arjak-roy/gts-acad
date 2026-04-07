import { z } from "zod";

export const curriculumStatusEnum = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const curriculumItemTypeEnum = z.enum(["CONTENT", "ASSESSMENT"]);

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

export const createCurriculumModuleSchema = z.object({
  curriculumId: z.string().trim().min(1, "Curriculum ID is required."),
  title: z.string().trim().min(2, "Module title must be at least 2 characters.").max(255),
  description: z.string().trim().max(2000).optional().default(""),
});

export const moduleIdSchema = z.object({
  moduleId: z.string().trim().min(1, "Module ID is required."),
});

export const updateCurriculumModuleSchema = z.object({
  moduleId: z.string().trim().min(1),
  title: z.string().trim().min(2).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
});

export const reorderCurriculumModulesSchema = z.object({
  curriculumId: z.string().trim().min(1, "Curriculum ID is required."),
  moduleIds: z.array(z.string().trim().min(1)).min(1, "At least one module is required."),
});

export const createCurriculumStageSchema = z.object({
  moduleId: z.string().trim().min(1, "Module ID is required."),
  title: z.string().trim().min(2, "Stage title must be at least 2 characters.").max(255),
  description: z.string().trim().max(2000).optional().default(""),
});

export const stageIdSchema = z.object({
  stageId: z.string().trim().min(1, "Stage ID is required."),
});

export const updateCurriculumStageSchema = z.object({
  stageId: z.string().trim().min(1),
  title: z.string().trim().min(2).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
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

export const stageItemIdSchema = z.object({
  itemId: z.string().trim().min(1, "Item ID is required."),
});

export const updateCurriculumStageItemSchema = z.object({
  itemId: z.string().trim().min(1),
  isRequired: z.coerce.boolean().optional(),
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

export type CreateCurriculumInput = z.infer<typeof createCurriculumSchema>;
export type UpdateCurriculumInput = z.infer<typeof updateCurriculumSchema>;
export type CreateCurriculumModuleInput = z.infer<typeof createCurriculumModuleSchema>;
export type UpdateCurriculumModuleInput = z.infer<typeof updateCurriculumModuleSchema>;
export type ReorderCurriculumModulesInput = z.infer<typeof reorderCurriculumModulesSchema>;
export type CreateCurriculumStageInput = z.infer<typeof createCurriculumStageSchema>;
export type UpdateCurriculumStageInput = z.infer<typeof updateCurriculumStageSchema>;
export type ReorderCurriculumStagesInput = z.infer<typeof reorderCurriculumStagesSchema>;
export type CreateCurriculumStageItemInput = z.infer<typeof createCurriculumStageItemSchema>;
export type UpdateCurriculumStageItemInput = z.infer<typeof updateCurriculumStageItemSchema>;
export type ReorderCurriculumStageItemsInput = z.infer<typeof reorderCurriculumStageItemsSchema>;
export type AssignCurriculumToBatchInput = z.infer<typeof assignCurriculumToBatchSchema>;
export type RemoveCurriculumFromBatchInput = z.infer<typeof removeCurriculumFromBatchSchema>;