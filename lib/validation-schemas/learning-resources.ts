import { z } from "zod";

import { authoredContentDocumentSchema } from "@/lib/authored-content";

export const learningResourceContentTypeEnum = z.enum(["ARTICLE", "PDF", "DOCUMENT", "VIDEO", "SCORM", "LINK", "OTHER"]);
export const learningResourceStatusEnum = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const learningResourceVisibilityEnum = z.enum(["PRIVATE", "RESTRICTED", "PUBLIC"]);
export const learningResourceTargetTypeEnum = z.enum(["COURSE", "BATCH", "ASSESSMENT_POOL", "SCHEDULE_EVENT"]);
export const learningResourceUsageTypeEnum = z.enum(["PREVIEW", "DOWNLOAD"]);
export const uploadStorageProviderEnum = z.enum(["LOCAL_PUBLIC", "S3"]);

const learningResourceAttachmentSchema = z.object({
  title: z.string().trim().max(255).optional().default(""),
  fileUrl: z.string().trim().min(1, "Attachment file is required."),
  fileName: z.string().trim().min(1, "Attachment file name is required.").max(255),
  fileSize: z.coerce.number().int().nonnegative().optional(),
  mimeType: z.string().trim().max(100).optional().default(""),
  storagePath: z.string().trim().max(500).optional().default(""),
  storageProvider: uploadStorageProviderEnum.optional(),
});

const baseLearningResourceSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(255),
  description: z.string().trim().max(2000).optional().default(""),
  excerpt: z.string().trim().max(500).optional().default(""),
  contentType: learningResourceContentTypeEnum,
  visibility: learningResourceVisibilityEnum.default("PRIVATE"),
  categoryName: z.string().trim().max(120).optional().default(""),
  subcategoryName: z.string().trim().max(120).optional().default(""),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).optional().default([]),
  fileUrl: z.string().trim().max(2000).optional().default(""),
  fileName: z.string().trim().max(255).optional().default(""),
  fileSize: z.coerce.number().int().nonnegative().optional(),
  mimeType: z.string().trim().max(100).optional().default(""),
  storagePath: z.string().trim().max(500).optional().default(""),
  storageProvider: uploadStorageProviderEnum.optional(),
  bodyJson: authoredContentDocumentSchema.optional().nullable(),
  estimatedReadingMinutes: z.coerce.number().int().positive().max(600).optional(),
  attachments: z.array(learningResourceAttachmentSchema).max(20).optional().default([]),
  changeSummary: z.string().trim().max(500).optional().default(""),
});

export const createLearningResourceSchema = baseLearningResourceSchema.extend({
  status: learningResourceStatusEnum.default("DRAFT"),
}).superRefine((value, ctx) => {
  if (value.subcategoryName && !value.categoryName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choose or enter a category before using a subcategory.",
      path: ["subcategoryName"],
    });
  }

  if (value.contentType === "ARTICLE" && !value.bodyJson) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Authored resources require body blocks.",
      path: ["bodyJson"],
    });
  }

  if (value.contentType !== "ARTICLE" && !value.fileUrl.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A file or destination URL is required for this resource type.",
      path: ["fileUrl"],
    });
  }
});

export const updateLearningResourceSchema = baseLearningResourceSchema.partial().extend({
  resourceId: z.string().trim().min(1, "Resource ID is required."),
  contentType: learningResourceContentTypeEnum.optional(),
  visibility: learningResourceVisibilityEnum.optional(),
  status: learningResourceStatusEnum.optional(),
});

export const importLearningResourceSchema = z.object({
  contentId: z.string().trim().min(1, "Content ID is required."),
  title: z.string().trim().min(2).max(255).optional(),
  categoryName: z.string().trim().max(120).optional().default(""),
  subcategoryName: z.string().trim().max(120).optional().default(""),
  visibility: learningResourceVisibilityEnum.optional(),
  status: learningResourceStatusEnum.optional(),
  changeSummary: z.string().trim().max(500).optional().default(""),
});

export const syncLearningResourcesFromContentSchema = z.object({
  contentIds: z.array(z.string().trim().min(1, "Content ID is required.")).min(1).max(200),
});

export const resourceIdSchema = z.object({
  resourceId: z.string().trim().min(1, "Resource ID is required."),
});

export const listLearningResourcesQuerySchema = z.object({
  search: z.string().trim().max(255).optional(),
  status: learningResourceStatusEnum.optional(),
  visibility: learningResourceVisibilityEnum.optional(),
  contentType: learningResourceContentTypeEnum.optional(),
  categoryId: z.string().trim().min(1).optional(),
  tag: z.string().trim().min(1).optional(),
});

export const assignLearningResourceSchema = z.object({
  assignments: z.array(z.object({
    targetType: learningResourceTargetTypeEnum,
    targetId: z.string().trim().min(1, "Target ID is required."),
    notes: z.string().trim().max(1000).optional().default(""),
  })).min(1, "Select at least one assignment target."),
});

export const removeLearningResourceAssignmentSchema = z.object({
  assignmentId: z.string().trim().min(1, "Assignment ID is required."),
});

export const restoreLearningResourceVersionSchema = z.object({
  versionId: z.string().trim().min(1, "Version ID is required."),
  changeSummary: z.string().trim().max(500).optional().default(""),
});

export const recordLearningResourceUsageSchema = z.object({
  eventType: learningResourceUsageTypeEnum,
  assignmentId: z.string().trim().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export type CreateLearningResourceInput = z.infer<typeof createLearningResourceSchema>;
export type UpdateLearningResourceInput = z.infer<typeof updateLearningResourceSchema>;
export type ImportLearningResourceInput = z.infer<typeof importLearningResourceSchema>;
export type SyncLearningResourcesFromContentInput = z.infer<typeof syncLearningResourcesFromContentSchema>;
export type ListLearningResourcesQueryInput = z.infer<typeof listLearningResourcesQuerySchema>;
export type AssignLearningResourceInput = z.infer<typeof assignLearningResourceSchema>;
export type RemoveLearningResourceAssignmentInput = z.infer<typeof removeLearningResourceAssignmentSchema>;
export type RestoreLearningResourceVersionInput = z.infer<typeof restoreLearningResourceVersionSchema>;
export type RecordLearningResourceUsageInput = z.infer<typeof recordLearningResourceUsageSchema>;
