import { z } from "zod";

import { authoredContentAnyDocumentSchema } from "@/lib/authored-content";

export const contentTypeEnum = z.enum(["ARTICLE", "PDF", "DOCUMENT", "VIDEO", "SCORM", "LINK", "OTHER"]);
export const contentStatusEnum = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const uploadStorageProviderEnum = z.enum(["LOCAL_PUBLIC", "S3"]);

export const createContentSchema = z.object({
  courseId: z.string().trim().min(1, "Course is required."),
  folderId: z.string().trim().min(1).optional().nullable(),
  repositoryFolderId: z.string().trim().min(1).optional().nullable(),
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(255),
  description: z.string().trim().max(2000).optional().default(""),
  contentType: contentTypeEnum,
  fileUrl: z.string().trim().optional().default(""),
  fileName: z.string().trim().max(255).optional().default(""),
  fileSize: z.coerce.number().int().nonnegative().optional(),
  mimeType: z.string().trim().max(100).optional().default(""),
  storagePath: z.string().trim().max(500).optional().default(""),
  storageProvider: uploadStorageProviderEnum.optional(),
  excerpt: z.string().trim().max(500).optional().default(""),
  estimatedReadingMinutes: z.coerce.number().int().positive().max(600).optional(),
  bodyJson: authoredContentAnyDocumentSchema.optional().nullable(),
  status: contentStatusEnum.optional().default("DRAFT"),
  isScorm: z.coerce.boolean().optional().default(false),
}).superRefine((value, ctx) => {
  if (value.contentType === "ARTICLE" && !value.bodyJson) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Authored content requires body content.",
      path: ["bodyJson"],
    });
  }
});

export const uploadCourseContentSchema = z.object({
  courseId: z.string().trim().min(1, "Course is required."),
  folderId: z.string().trim().min(1).optional().nullable(),
  repositoryFolderId: z.string().trim().min(1).optional().nullable(),
  description: z.string().trim().max(2000).optional().default(""),
  contentType: contentTypeEnum.refine((value) => value !== "LINK" && value !== "SCORM" && value !== "ARTICLE", {
    message: "Uploaded files must use PDF, document, video, or other uploaded asset content types.",
  }),
  status: contentStatusEnum.optional().default("DRAFT"),
});

export const contentIdSchema = z.object({
  contentId: z.string().trim().min(1, "Content ID is required."),
});

export const updateContentSchema = z.object({
  contentId: z.string().trim().min(1),
  folderId: z.string().trim().min(1).optional().nullable(),
  title: z.string().trim().min(2).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
  contentType: contentTypeEnum.optional(),
  fileUrl: z.string().trim().max(2000).optional(),
  excerpt: z.string().trim().max(500).optional(),
  estimatedReadingMinutes: z.coerce.number().int().positive().max(600).optional(),
  bodyJson: authoredContentAnyDocumentSchema.optional().nullable(),
  status: contentStatusEnum.optional(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
});

export const createCourseContentFolderSchema = z.object({
  courseId: z.string().trim().min(1, "Course is required."),
  name: z.string().trim().min(2, "Folder name must be at least 2 characters.").max(255),
  description: z.string().trim().max(2000).optional().default(""),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
});

export const folderIdSchema = z.object({
  folderId: z.string().trim().min(1, "Folder ID is required."),
});

export const updateCourseContentFolderSchema = z.object({
  folderId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
});

export type CreateContentInput = z.infer<typeof createContentSchema>;
export type UploadCourseContentInput = z.infer<typeof uploadCourseContentSchema>;
export type UpdateContentInput = z.infer<typeof updateContentSchema>;
export type CreateCourseContentFolderInput = z.infer<typeof createCourseContentFolderSchema>;
export type UpdateCourseContentFolderInput = z.infer<typeof updateCourseContentFolderSchema>;
