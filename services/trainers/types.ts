import type { CsvImportIssue } from "@/lib/bulk-import/csv";
import type { TrainerImportCommitRow } from "@/lib/validation-schemas/trainers";

export const TRAINER_AVAILABILITY_STATUSES = ["AVAILABLE", "LIMITED", "UNAVAILABLE", "ON_LEAVE"] as const;
export const TRAINER_AVAILABILITY_LABELS: Record<TrainerAvailabilityStatus, string> = {
  AVAILABLE: "Available",
  LIMITED: "Limited",
  UNAVAILABLE: "Unavailable",
  ON_LEAVE: "On Leave",
};

export type TrainerAvailabilityStatus = (typeof TRAINER_AVAILABILITY_STATUSES)[number];
export type TrainerStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export type TrainerOption = {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
  department: string | null;
  specialization: string;
  isActive: boolean;
  trainerStatus: TrainerStatus;
  availabilityStatus: TrainerAvailabilityStatus;
  courses: string[];
  lastActiveAt: string | null;
  lastUpdatedAt: string | null;
  lastUpdatedByName: string | null;
};

export type TrainerRegistryResponse = {
  items: TrainerOption[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filterOptions: {
    specializations: string[];
    departments: string[];
  };
};

export type TrainerCreateResult = {
  id: string;
  userId: string;
  fullName: string;
  employeeCode: string;
  email: string;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  specialization: string;
  skills: string[];
  certifications: string[];
  experienceYears: number | null;
  preferredLanguage: string | null;
  timeZone: string | null;
  profilePhotoUrl: string | null;
  bio: string | null;
  capacity: number;
  status: TrainerStatus;
  availabilityStatus: TrainerAvailabilityStatus;
  courses: string[];
  lastActiveAt: string | null;
};

export type TrainerDetail = {
  id: string;
  userId: string;
  fullName: string;
  employeeCode: string;
  email: string;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  specialization: string;
  skills: string[];
  certifications: string[];
  experienceYears: number | null;
  preferredLanguage: string | null;
  timeZone: string | null;
  profilePhotoUrl: string | null;
  bio: string | null;
  capacity: number;
  status: TrainerStatus;
  availabilityStatus: TrainerAvailabilityStatus;
  courses: string[];
  lastActiveAt: string | null;
  lastUpdatedAt: string | null;
  lastUpdatedByName: string | null;
};

export type TrainerStatusHistoryItem = {
  id: string;
  oldStatus: TrainerStatus;
  newStatus: TrainerStatus;
  reason: string | null;
  changedById: string | null;
  changedByName: string | null;
  changedAt: string;
};

export type TrainerImportIssue = CsvImportIssue;

export type TrainerImportRowInput = {
  fullName: string;
  employeeCode: string;
  email: string;
  phone: string;
  specialization: string;
  capacity: string;
  status: string;
  availabilityStatus: string;
  courses: string;
  bio: string;
};

export type TrainerImportNormalizedRow = TrainerImportCommitRow;

export type TrainerImportRow = {
  rowNumber: number;
  status: "create" | "error";
  input: TrainerImportRowInput;
  normalizedEmail: string | null;
  normalizedEmployeeCode: string | null;
  normalizedData: TrainerImportNormalizedRow | null;
  issues: TrainerImportIssue[];
};

export type TrainerImportPreview = {
  fileName: string;
  headers: string[];
  totalRows: number;
  createCount: number;
  errorCount: number;
  actionableCount: number;
  hasBlockingErrors: boolean;
  rows: TrainerImportRow[];
};

export type TrainerImportCommitResult = {
  fileName: string;
  createdCount: number;
  totalCount: number;
};

export type TrainerPerformanceSummary = {
  trainerId: string;
  assignedCourses: number;
  numberOfLearners: number;
  completionRate: number;
  averageLearnerScore: number;
  pendingReviews: number;
  lastActiveAt: string | null;
};

export type TrainerActivityType = "COURSE_ASSIGNMENT" | "QUIZ_ASSIGNMENT" | "LOGIN" | "AUDIT";

export type TrainerActivityItem = {
  id: string;
  type: TrainerActivityType;
  title: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
};

export type TrainerActivityResponse = {
  items: TrainerActivityItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};
