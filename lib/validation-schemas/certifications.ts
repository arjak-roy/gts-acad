import { z } from "zod";

// ── Enums ────────────────────────────────────────────────────────────────────
export const certificateOrientationEnum = z.enum(["LANDSCAPE", "PORTRAIT"]);
export const certificatePaperSizeEnum = z.enum(["A4", "LETTER", "CUSTOM"]);
export const certificateStatusEnum = z.enum(["ISSUED", "REVOKED", "EXPIRED"]);

// ── Canvas element schemas ───────────────────────────────────────────────────
const baseElementSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().min(1),
  height: z.number().min(1),
  rotation: z.number().optional(),
  zIndex: z.number().int().optional(),
});

const textElementSchema = baseElementSchema.extend({
  type: z.literal("text"),
  content: z.string(),
  fontSize: z.number().min(6).max(200).optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.enum(["normal", "bold", "light"]).optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
});

const dynamicTextElementSchema = baseElementSchema.extend({
  type: z.literal("dynamic-text"),
  template: z.string(),
  fontSize: z.number().min(6).max(200).optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.enum(["normal", "bold", "light"]).optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
});

const imageElementSchema = baseElementSchema.extend({
  type: z.literal("image"),
  source: z.enum(["logo", "signature1", "signature2", "background", "custom"]),
  url: z.string().optional(),
  objectFit: z.enum(["contain", "cover", "fill"]).optional(),
  opacity: z.number().min(0).max(1).optional(),
});

const qrCodeElementSchema = baseElementSchema.extend({
  type: z.literal("qr-code"),
  foregroundColor: z.string().optional(),
  backgroundColor: z.string().optional(),
});

const shapeElementSchema = baseElementSchema.extend({
  type: z.literal("shape"),
  shape: z.enum(["rectangle", "circle", "line"]),
  fillColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().min(0).optional(),
  borderRadius: z.number().min(0).optional(),
  opacity: z.number().min(0).max(1).optional(),
});

const borderElementSchema = baseElementSchema.extend({
  type: z.literal("border"),
  borderColor: z.string().optional(),
  borderWidth: z.number().min(1).optional(),
  borderStyle: z.enum(["solid", "double", "dashed"]).optional(),
  borderRadius: z.number().min(0).optional(),
});

export const canvasElementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  dynamicTextElementSchema,
  imageElementSchema,
  qrCodeElementSchema,
  shapeElementSchema,
  borderElementSchema,
]);

export const layoutJsonSchema = z.array(canvasElementSchema);

// ── Template schemas ─────────────────────────────────────────────────────────
export const createCertificateTemplateSchema = z.object({
  courseId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  orientation: certificateOrientationEnum.optional(),
  paperSize: certificatePaperSizeEnum.optional(),
});
export type CreateCertificateTemplateInput = z.infer<typeof createCertificateTemplateSchema>;

export const createBaseTemplateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  orientation: certificateOrientationEnum.optional(),
  paperSize: certificatePaperSizeEnum.optional(),
});
export type CreateBaseTemplateInput = z.infer<typeof createBaseTemplateSchema>;

export const importBaseTemplateToCourseSchema = z.object({
  courseId: z.string().uuid(),
});
export type ImportBaseTemplateToCourseInput = z.infer<typeof importBaseTemplateToCourseSchema>;

export const updateCertificateTemplateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  orientation: certificateOrientationEnum.optional(),
  paperSize: certificatePaperSizeEnum.optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateCertificateTemplateInput = z.infer<typeof updateCertificateTemplateSchema>;

export const updateTemplateLayoutSchema = z.object({
  layoutJson: layoutJsonSchema,
});
export type UpdateTemplateLayoutInput = z.infer<typeof updateTemplateLayoutSchema>;

export const updateTemplateBrandingSchema = z.object({
  backgroundColor: z.string().max(30).optional().nullable(),
  backgroundImageUrl: z.string().max(2000).optional().nullable(),
  logoUrl: z.string().max(2000).optional().nullable(),
  signatory1Name: z.string().max(255).optional().nullable(),
  signatory1Title: z.string().max(255).optional().nullable(),
  signatory1SignatureUrl: z.string().max(2000).optional().nullable(),
  signatory2Name: z.string().max(255).optional().nullable(),
  signatory2Title: z.string().max(255).optional().nullable(),
  signatory2SignatureUrl: z.string().max(2000).optional().nullable(),
});
export type UpdateTemplateBrandingInput = z.infer<typeof updateTemplateBrandingSchema>;

// ── Auto-issue rule schemas ──────────────────────────────────────────────────
export const autoIssueTriggerEnum = z.enum(["CURRICULUM_COMPLETION", "ENROLLMENT_COMPLETION"]);
export const certificateAutoIssueAttemptStatusEnum = z.enum(["ISSUED", "SKIPPED", "FAILED"]);

export const createAutoIssueRuleSchema = z.object({
  curriculumId: z.string().uuid().optional().nullable(),
  trigger: autoIssueTriggerEnum,
});
export type CreateAutoIssueRuleInput = z.infer<typeof createAutoIssueRuleSchema>;

export const toggleAutoIssueRuleSchema = z.object({
  isActive: z.boolean(),
});

// ── Certificate issuance schemas ─────────────────────────────────────────────
export const issueCertificateSchema = z.object({
  learnerId: z.string().uuid(),
  courseId: z.string().uuid(),
  programId: z.string().uuid(),
  batchId: z.string().uuid().optional().nullable(),
  templateId: z.string().uuid(),
  expiresAt: z.coerce.date().optional().nullable(),
});
export type IssueCertificateInput = z.infer<typeof issueCertificateSchema>;

export const bulkIssueCertificatesSchema = z.object({
  learnerIds: z.array(z.string().uuid()).min(1).max(500),
  courseId: z.string().uuid(),
  programId: z.string().uuid(),
  batchId: z.string().uuid().optional().nullable(),
  templateId: z.string().uuid(),
  expiresAt: z.coerce.date().optional().nullable(),
});
export type BulkIssueCertificatesInput = z.infer<typeof bulkIssueCertificatesSchema>;

export const revokeCertificateSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type RevokeCertificateInput = z.infer<typeof revokeCertificateSchema>;
