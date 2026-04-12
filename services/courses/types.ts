import { BatchMode, BatchStatus, CourseStatus, ProgramType } from "@prisma/client";

import type { AssignedSharedContentListItem } from "@/services/course-content/types";

export type CourseProgramSummary = {
  id: string;
  name: string;
  type: ProgramType;
  isActive: boolean;
  batches: CourseBatchSummary[];
  batchCount: number;
  trainerCount: number;
  candidateCount: number;
};

export type CourseTrainerSummary = {
  id: string;
  fullName: string;
  email: string;
  specialization: string;
  isActive: boolean;
  assignedBatchIds: string[];
  assignedBatchLabels: string[];
  assignedProgramNames: string[];
};

export type CourseBatchSummary = {
  id: string;
  programId: string;
  programName: string;
  programType: ProgramType;
  code: string;
  name: string;
  status: BatchStatus;
  mode: BatchMode;
  campus: string | null;
  startDate: string | null;
  endDate: string | null;
  capacity: number;
  trainerIds: string[];
  trainerNames: string[];
  candidateCount: number;
};

export type CourseCandidateEnrollmentSummary = {
  batchId: string;
  batchCode: string;
  batchName: string;
  programId: string;
  programName: string;
  joinedAt: string;
};

export type CourseCandidateSummary = {
  id: string;
  learnerCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  enrollmentCount: number;
  enrollments: CourseCandidateEnrollmentSummary[];
};

export type CourseOption = {
  id: string;
  name: string;
  description: string | null;
  status: CourseStatus;
  isActive: boolean;
  programCount: number;
};

export type CourseCreateResult = CourseOption;

export type CourseDetail = {
  id: string;
  name: string;
  description: string | null;
  status: CourseStatus;
  isActive: boolean;
  programs: CourseProgramSummary[];
  batches: CourseBatchSummary[];
  trainers: CourseTrainerSummary[];
  candidates: CourseCandidateSummary[];
  assignedSharedContents: AssignedSharedContentListItem[];
};
