export const SystemRoleCode = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ACADEMY_ADMIN: "ACADEMY_ADMIN",
  TRAINER: "TRAINER",
  CONTENT_MANAGER: "CONTENT_MANAGER",
  SUPPORT_USER: "SUPPORT_USER",
  CANDIDATE: "CANDIDATE",
} as const;

export type SystemRoleCode = (typeof SystemRoleCode)[keyof typeof SystemRoleCode];

export const ProgramType = {
  LANGUAGE: "LANGUAGE",
  CLINICAL: "CLINICAL",
  TECHNICAL: "TECHNICAL",
} as const;

export type ProgramType = (typeof ProgramType)[keyof typeof ProgramType];

export const PlacementStatus = {
  NOT_READY: "NOT_READY",
  IN_REVIEW: "IN_REVIEW",
  PLACEMENT_READY: "PLACEMENT_READY",
} as const;

export type PlacementStatus = (typeof PlacementStatus)[keyof typeof PlacementStatus];

export const SyncStatus = {
  NOT_SYNCED: "NOT_SYNCED",
  QUEUED: "QUEUED",
  SYNCED: "SYNCED",
  FAILED: "FAILED",
} as const;

export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

export const ExamType = {
  IELTS: "IELTS",
  OET: "OET",
  NCLEX: "NCLEX",
  GOETHE_A1: "GOETHE_A1",
  GOETHE_A2: "GOETHE_A2",
  GOETHE_B1: "GOETHE_B1",
  GOETHE_B2: "GOETHE_B2",
  PROMETRIC: "PROMETRIC",
} as const;

export type ExamType = (typeof ExamType)[keyof typeof ExamType];

export const BatchStatus = {
  DRAFT: "DRAFT",
  PLANNED: "PLANNED",
  IN_SESSION: "IN_SESSION",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
  CANCELLED: "CANCELLED",
} as const;

export type BatchStatus = (typeof BatchStatus)[keyof typeof BatchStatus];

export const BatchMode = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
} as const;

export type BatchMode = (typeof BatchMode)[keyof typeof BatchMode];

export const EnrollmentStatus = {
  ACTIVE: "ACTIVE",
  ON_HOLD: "ON_HOLD",
  COMPLETED: "COMPLETED",
  DROPPED: "DROPPED",
} as const;

export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];

export type DashboardTrendPoint = {
  label: string;
  activeLearners: number;
  placementReady: number;
};

export type DashboardFunnelStage = {
  label: string;
  value: number;
  accent: string;
};

export type DashboardAlert = {
  id: string;
  title: string;
  message: string;
  tone: "danger" | "info";
};

export type DashboardStats = {
  activeLearners: number;
  liveBatches: number;
  averageAttendance: number;
  averageAssessmentScore: number;
  certificatesIssuedYtd: number;
  placementReady: number;
  capacityUtilization: number;
  readinessFunnel: DashboardFunnelStage[];
  operationsSnapshot: DashboardAlert[];
  trends: DashboardTrendPoint[];
};

export type DashboardSearchSection = "insights" | "learners" | "batches" | "trainers" | "programs" | "courses";

export type DashboardSearchItem = {
  id: string;
  section: DashboardSearchSection;
  title: string;
  description: string;
  href: string;
};

export type DashboardSearchGroup = {
  key: DashboardSearchSection;
  label: string;
  items: DashboardSearchItem[];
};

export type DashboardSearchResult = {
  query: string;
  total: number;
  groups: DashboardSearchGroup[];
};

export type LearnerListItem = {
  id: string;
  learnerCode: string;
  fullName: string;
  email: string;
  attendancePercentage: number;
  averageScore: number;
  readinessPercentage: number;
  placementStatus: PlacementStatus;
  recruiterSyncStatus: SyncStatus;
  programName: string | null;
  batchCode: string | null;
  campus: string | null;
  trainerName: string | null;
  programType: ProgramType | null;
};

export type LearnersResponse = {
  items: LearnerListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type LearnerActiveEnrollment = {
  id: string;
  status: EnrollmentStatus;
  joinedAt: string;
  completedAt: string | null;
  batchId: string;
  batchCode: string;
  batchName: string;
  batchStatus: BatchStatus;
  campus: string | null;
  startDate: string;
  endDate: string | null;
  mode: BatchMode;
  programId: string;
  programCode: string;
  programName: string;
  programType: ProgramType;
  courseCode: string;
  courseName: string;
  trainerNames: string[];
};

export type LearnerDetail = LearnerListItem & {
  phone?: string | null;
  country?: string | null;
  dob?: string | null;
  gender?: string | null;
  targetCountry?: string | null;
  targetLanguage?: string | null;
  targetExam?: ExamType | null;
  softSkillsScore?: number;
  latestSyncMessage?: string | null;
  activeEnrollments: LearnerActiveEnrollment[];
};

export type ReadinessSyncResult = {
  learnerId: string;
  learnerCode: string;
  syncStatus: SyncStatus;
  destination: string;
  message: string;
};

export type AttendancePayloadRow = {
  learnerId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  notes?: string;
};

export type PortalSectionMetric = {
  label: string;
  value: string;
  helper: string;
};

export type PortalSectionHighlight = {
  label: string;
  value: string;
  tone: "default" | "success" | "warning" | "danger" | "info" | "accent";
};

export type PortalSectionTableColumn = {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
};

export type PortalSectionTableRow = {
  id: string;
  [key: string]: string;
};

export type PortalSectionContent = {
  title: string;
  description: string;
  accent: string;
  summary: string;
  metrics: PortalSectionMetric[];
  highlights: PortalSectionHighlight[];
  tableTitle: string;
  tableDescription: string;
  tableColumns: PortalSectionTableColumn[];
  tableRows: PortalSectionTableRow[];
  primaryAction: string;
  secondaryAction: string;
};

export type InternalUserRoleInfo = {
  id: string;
  name: string;
  code: string;
  isSystemRole: boolean;
};

export type WelcomeEmailStatus = "not_requested" | "pending" | "sent" | "failed";

export type InternalUserListItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: InternalUserRoleInfo[];
  primaryRoleCode: string | null;
  onboardingStatus: WelcomeEmailStatus;
  requiresPasswordReset: boolean;
};

export type InternalUsersResponse = {
  items: InternalUserListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type InternalUserDetail = InternalUserListItem & {
  metadata: Record<string, unknown>;
};
