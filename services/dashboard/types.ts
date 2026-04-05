import { DashboardStats, DashboardTrendPoint } from "@/types";

export type DashboardSummaryRow = {
  activeLearners: number;
  liveBatches: number;
  averageAttendance: number;
  averageAssessmentScore: number;
  certificatesIssuedYtd: number;
  placementReady: number;
  capacityUtilization: number;
  totalEnrolled: number;
  activeLearning: number;
  assessmentCleared: number;
};

export type DashboardTrendRow = DashboardTrendPoint;

export const DEFAULT_DASHBOARD_STATS: DashboardStats = {
  activeLearners: 3,
  liveBatches: 2,
  averageAttendance: 93.1,
  averageAssessmentScore: 81,
  certificatesIssuedYtd: 0,
  placementReady: 2,
  capacityUtilization: 41,
  readinessFunnel: [
    { label: "Total Enrolled", value: 3, accent: "bg-slate-900" },
    { label: "Active Learning", value: 3, accent: "bg-blue-700" },
    { label: "Assessment Cleared", value: 3, accent: "bg-blue-500" },
    { label: "Placement Ready", value: 2, accent: "bg-[var(--accent-orange)]" },
  ],
  operationsSnapshot: [
    {
      id: "data-seeded",
      title: "Data Ready",
      message: "Using seeded development database.",
      tone: "info" as const,
    },
  ],
  trends: [
    { label: "Jan", activeLearners: 1, placementReady: 0 },
    { label: "Feb", activeLearners: 2, placementReady: 1 },
    { label: "Mar", activeLearners: 3, placementReady: 2 },
  ],
};
