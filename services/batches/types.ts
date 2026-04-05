import { BatchMode, BatchStatus } from "@prisma/client";

export type TrainerSummary = {
  id: string;
  fullName: string;
};

export type BatchRecord = {
  id: string;
  code: string;
  name: string;
  campus: string | null;
  status: BatchStatus;
  startDate: Date;
  endDate: Date | null;
  capacity: number;
  mode: BatchMode;
  schedule: string[];
  program: { name: string };
  trainer: { id: string; user: { name: string } } | null;
  trainers: Array<{ id: string; user: { name: string } }>;
};

export type BatchOption = {
  id: string;
  code: string;
  name: string;
  programName: string;
  campus: string | null;
  status: BatchStatus;
  trainerIds: string[];
  trainerNames: string[];
  startDate?: string;
  endDate?: string | null;
  capacity?: number;
  mode?: BatchMode;
  schedule?: string[];
};

export type BatchCreateResult = {
  id: string;
  code: string;
  name: string;
  programName: string;
  campus: string | null;
  startDate: string;
  endDate: string | null;
  capacity: number;
  mode: BatchMode;
  status: BatchStatus;
  trainerIds: string[];
  trainerNames: string[];
};

export type BatchEnrollmentCandidate = {
  id: string;
  learnerCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  country: string | null;
  programId: string | null;
  programName: string | null;
  courseId: string | null;
  courseName: string | null;
  currentBatchCode: string | null;
  currentBatchName: string | null;
  campus: string | null;
};

export type BatchEnrollmentCandidatesResponse = {
  items: BatchEnrollmentCandidate[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type BatchEnrolledLearner = {
  id: string;
  learnerCode: string;
  fullName: string;
};

export type BatchEnrolledLearnersResponse = {
  items: BatchEnrolledLearner[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type BatchBulkEnrollmentResultItem = {
  learnerCode: string;
  status: "ENROLLED" | "SKIPPED" | "FAILED";
  message: string;
};

export type BatchBulkEnrollmentResult = {
  batchId: string;
  batchCode: string;
  processed: number;
  enrolled: number;
  skipped: number;
  failed: number;
  results: BatchBulkEnrollmentResultItem[];
};

export type BatchEnrollmentExportRow = {
  learnerCode: string;
  learnerName: string;
  learnerEmail: string;
  learnerPhone: string;
  learnerCountry: string;
  placementStatus: string;
  recruiterSyncStatus: string;
  readinessPercentage: string;
  attendancePercentage: string;
  averageScore: string;
  courseCode: string;
  courseName: string;
  programCode: string;
  programName: string;
  programType: string;
  batchCode: string;
  batchName: string;
  batchStatus: string;
  batchMode: string;
  campus: string;
  enrollmentStatus: string;
  joinedAt: string;
  completedAt: string;
  trainerNames: string;
};
