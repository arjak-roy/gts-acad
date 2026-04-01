export const UserRole = {
  ADMIN: "ADMIN",
  TRAINER: "TRAINER",
  LEARNER: "LEARNER",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

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

export type DashboardSearchSection = "insights" | "learners" | "batches" | "trainers" | "programs";

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

export type LearnerDetail = LearnerListItem & {
  phone?: string | null;
  country?: string | null;
  softSkillsScore?: number;
  latestSyncMessage?: string | null;
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