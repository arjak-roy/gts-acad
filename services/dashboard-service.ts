import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { DashboardStats, DashboardTrendPoint } from "@/types";

type DashboardSummaryRow = {
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

type DashboardTrendRow = DashboardTrendPoint;

const DEFAULT_DASHBOARD_STATS: DashboardStats = {
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

/**
 * Returns aggregate dashboard metrics and trend data for portal dashboards.
 * Uses SQL aggregations when a database connection is available.
 * Falls back to default stats to keep local development predictable.
 */
export async function getDashboardStatsService(): Promise<DashboardStats> {
  if (!isDatabaseConfigured) {
    return DEFAULT_DASHBOARD_STATS;
  }

  try {
    const [summary] = await prisma.$queryRaw<DashboardSummaryRow[]>`
      WITH live_batch_metrics AS (
        SELECT
          COUNT(DISTINCT b.batch_id)::int AS "liveBatches",
          COALESCE(
            ROUND(
              AVG(
                CASE
                  WHEN b.capacity = 0 THEN 0
                  ELSE (COALESCE(be.enrolled, 0)::numeric / b.capacity::numeric) * 100
                END
              ),
              1
            ),
            0
          )::float AS "capacityUtilization"
        FROM batches b
        LEFT JOIN (
          SELECT batch_id, COUNT(*)::int AS enrolled
          FROM candidate_batch_enrollments
          WHERE status = 'active'
          GROUP BY batch_id
        ) be ON be.batch_id = b.batch_id
        WHERE b.status = 'in_session'
      ),
      attendance_metrics AS (
        SELECT COALESCE(
          ROUND(
            AVG(
              CASE status
                WHEN 'present' THEN 100
                WHEN 'late' THEN 60
                WHEN 'excused' THEN 80
                ELSE 0
              END
            ),
            1
          ),
          0
        )::float AS "averageAttendance"
        FROM attendance_tracker
      ),
      assessment_metrics AS (
        SELECT COALESCE(ROUND(AVG(score), 1), 0)::float AS "averageAssessmentScore"
        FROM assessment_scores
      ),
      learner_metrics AS (
        SELECT COUNT(*)::int AS "activeLearners"
        FROM candidates
        WHERE is_active = true
      ),
      certificate_metrics AS (
        SELECT COUNT(*)::int AS "certificatesIssuedYtd"
        FROM candidate_certificates
        WHERE DATE_PART('year', issued_at) = DATE_PART('year', CURRENT_DATE)
      ),
      enrollment_metrics AS (
        SELECT
          COUNT(DISTINCT candidate_id)::int AS "totalEnrolled",
          COUNT(DISTINCT CASE WHEN status = 'active' THEN candidate_id END)::int AS "activeLearning"
        FROM candidate_batch_enrollments
      ),
      assessment_funnel_metrics AS (
        SELECT COUNT(DISTINCT candidate_id)::int AS "assessmentCleared"
        FROM assessment_scores
      ),
      readiness_metrics AS (
        SELECT COUNT(*)::int AS "placementReady"
        FROM candidates
        WHERE placement_status = 'placement_ready'
      )
      SELECT
        lm."activeLearners",
        lbm."liveBatches",
        am."averageAttendance",
        asm."averageAssessmentScore",
        cm."certificatesIssuedYtd",
        rm."placementReady",
        lbm."capacityUtilization",
        em."totalEnrolled",
        em."activeLearning",
        afm."assessmentCleared"
      FROM learner_metrics lm
      CROSS JOIN live_batch_metrics lbm
      CROSS JOIN attendance_metrics am
      CROSS JOIN assessment_metrics asm
      CROSS JOIN certificate_metrics cm
      CROSS JOIN enrollment_metrics em
      CROSS JOIN assessment_funnel_metrics afm
      CROSS JOIN readiness_metrics rm
    `;

    const trends = await prisma.$queryRaw<DashboardTrendRow[]>`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE) - interval '5 months',
          date_trunc('month', CURRENT_DATE),
          interval '1 month'
        ) AS month_start
      )
      SELECT
        TO_CHAR(month_start, 'Mon') AS label,
        COALESCE((
          SELECT COUNT(*)
          FROM candidates l
          WHERE l.is_active = true
            AND date_trunc('month', l.created_at) <= month_start
        ), 0)::int AS "activeLearners",
        COALESCE((
          SELECT COUNT(*)
          FROM candidate_readiness_snapshots rs
          WHERE rs.status = 'placement_ready'
            AND date_trunc('month', rs.created_at) = month_start
        ), 0)::int AS "placementReady"
      FROM months
      ORDER BY month_start
    `;

    return {
      ...DEFAULT_DASHBOARD_STATS,
      ...summary,
      readinessFunnel: [
        { label: "Total Enrolled", value: summary.totalEnrolled, accent: "bg-slate-900" },
        { label: "Active Learning", value: summary.activeLearning, accent: "bg-blue-700" },
        { label: "Assessment Cleared", value: summary.assessmentCleared, accent: "bg-blue-500" },
        { label: "Placement Ready", value: summary.placementReady, accent: "bg-[var(--accent-orange)]" },
      ],
      trends,
    };
  } catch (error) {
    console.warn("Dashboard query fallback activated", error);
    return DEFAULT_DASHBOARD_STATS;
  }
}