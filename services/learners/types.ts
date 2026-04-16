import type { CsvImportIssue } from "@/lib/bulk-import/csv";
import type { LearnerImportCommitRow } from "@/lib/validation-schemas/learners";

import { LearnerDetail } from "@/types";

export type LearnerSearchItem = {
  id: string;
  learnerCode: string;
  fullName: string;
  email: string;
  programName: string | null;
  batchCode: string | null;
};

export type CandidateProfile = LearnerDetail & {
  userId: string;
  role: string;
  pathway: string;
};

export type LearnerImportIssue = CsvImportIssue;

export type LearnerImportRowInput = {
  fullName: string;
  email: string;
  phone: string;
  programName: string;
  batchCode: string;
  campus: string;
};

export type LearnerImportNormalizedRow = LearnerImportCommitRow;

export type LearnerImportRow = {
  rowNumber: number;
  status: "create" | "error";
  input: LearnerImportRowInput;
  normalizedEmail: string | null;
  normalizedBatchCode: string | null;
  normalizedData: LearnerImportNormalizedRow | null;
  issues: LearnerImportIssue[];
};

export type LearnerImportPreview = {
  fileName: string;
  headers: string[];
  totalRows: number;
  createCount: number;
  errorCount: number;
  actionableCount: number;
  hasBlockingErrors: boolean;
  rows: LearnerImportRow[];
};

export type LearnerImportCommitResult = {
  fileName: string;
  createdCount: number;
  totalCount: number;
};
