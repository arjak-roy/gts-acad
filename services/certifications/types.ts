import type {
  CertificateAutoIssueTrigger,
  CertificateOrientation,
  CertificatePaperSize,
  CertificateStatus,
} from "@prisma/client";

// ── Canvas element types (runtime mirror of Zod schemas) ─────────────────────

export type BaseCanvasElement = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
};

export type TextElement = BaseCanvasElement & {
  type: "text";
  content: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: "normal" | "bold" | "light";
  fontStyle?: "normal" | "italic";
  color?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
};

export type DynamicTextElement = BaseCanvasElement & {
  type: "dynamic-text";
  template: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: "normal" | "bold" | "light";
  fontStyle?: "normal" | "italic";
  color?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
};

export type ImageElement = BaseCanvasElement & {
  type: "image";
  source: "logo" | "signature1" | "signature2" | "background" | "custom";
  url?: string;
  objectFit?: "contain" | "cover" | "fill";
  opacity?: number;
};

export type QrCodeElement = BaseCanvasElement & {
  type: "qr-code";
  foregroundColor?: string;
  backgroundColor?: string;
};

export type ShapeElement = BaseCanvasElement & {
  type: "shape";
  shape: "rectangle" | "circle" | "line";
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  borderRadius?: number;
  opacity?: number;
};

export type BorderElement = BaseCanvasElement & {
  type: "border";
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: "solid" | "double" | "dashed";
  borderRadius?: number;
};

export type CanvasElement =
  | TextElement
  | DynamicTextElement
  | ImageElement
  | QrCodeElement
  | ShapeElement
  | BorderElement;

// ── Dynamic template variable keys ──────────────────────────────────────────

export const DYNAMIC_VARIABLES = [
  "learnerName",
  "courseName",
  "programName",
  "batchName",
  "issuedDate",
  "expiryDate",
  "certificateNumber",
  "verificationCode",
  "verificationUrl",
] as const;

export type DynamicVariableKey = (typeof DYNAMIC_VARIABLES)[number];

// ── Rendered data snapshot (frozen at issuance) ─────────────────────────────

export type CertificateRenderedData = {
  learnerName: string;
  courseName: string;
  programName: string;
  batchName: string | null;
  issuedDate: string;
  expiryDate: string | null;
  certificateNumber: string;
  verificationCode: string;
  verificationUrl: string;
};

// ── API / Service response types ────────────────────────────────────────────

export type CertificateTemplateSummary = {
  id: string;
  courseId: string | null;
  courseName: string | null;
  title: string;
  description: string | null;
  orientation: CertificateOrientation;
  paperSize: CertificatePaperSize;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CertificateTemplateWithPreview = CertificateTemplateSummary & {
  layoutJson: CanvasElement[];
  backgroundColor: string | null;
  backgroundImageUrl: string | null;
  logoUrl: string | null;
  signatory1SignatureUrl: string | null;
  signatory2SignatureUrl: string | null;
};

export type CertificateTemplateDetail = CertificateTemplateSummary & {
  layoutJson: CanvasElement[];
  backgroundColor: string | null;
  backgroundImageUrl: string | null;
  logoUrl: string | null;
  signatory1Name: string | null;
  signatory1Title: string | null;
  signatory1SignatureUrl: string | null;
  signatory2Name: string | null;
  signatory2Title: string | null;
  signatory2SignatureUrl: string | null;
  createdByName: string | null;
};

export type IssuedCertificateSummary = {
  id: string;
  certificateNumber: string | null;
  learnerName: string;
  learnerId: string;
  courseName: string | null;
  programName: string;
  batchName: string | null;
  status: CertificateStatus;
  issuedAt: string;
  issuedByName: string | null;
  verificationCode: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

export type IssuedCertificateDetail = IssuedCertificateSummary & {
  courseId: string | null;
  programId: string;
  batchId: string | null;
  templateId: string | null;
  renderedDataJson: CertificateRenderedData | null;
  revocationReason: string | null;
  revokedByName: string | null;
  templateTitle: string | null;
  layoutJson: CanvasElement[] | null;
  templateBranding: {
    backgroundColor: string | null;
    backgroundImageUrl: string | null;
    logoUrl: string | null;
    signatory1Name: string | null;
    signatory1Title: string | null;
    signatory1SignatureUrl: string | null;
    signatory2Name: string | null;
    signatory2Title: string | null;
    signatory2SignatureUrl: string | null;
    orientation: CertificateOrientation;
    paperSize: CertificatePaperSize;
  } | null;
};

export type PublicCertificateVerification = {
  status: CertificateStatus;
  certificateNumber: string | null;
  learnerName: string;
  courseName: string | null;
  programName: string;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  renderedDataJson: CertificateRenderedData | null;
  layoutJson: CanvasElement[] | null;
  templateBranding: {
    backgroundColor: string | null;
    backgroundImageUrl: string | null;
    logoUrl: string | null;
    orientation: CertificateOrientation;
    paperSize: CertificatePaperSize;
  } | null;
};

export type CertificateAutoIssueAttemptStatus = "ISSUED" | "SKIPPED" | "FAILED";

export type CertificateAutoIssueAttemptSummary = {
  id: string;
  learnerId: string;
  learnerName: string;
  batchId: string;
  batchCode: string;
  batchName: string;
  curriculumId: string | null;
  curriculumTitle: string | null;
  templateId: string | null;
  templateTitle: string | null;
  trigger: CertificateAutoIssueTrigger;
  status: CertificateAutoIssueAttemptStatus;
  reason: string | null;
  certificateId: string | null;
  attemptedAt: string;
  retriedFromAttemptId: string | null;
};
