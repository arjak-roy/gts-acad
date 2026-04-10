"use server";

import { dashboardSearchSchema, getDashboardStatsSchema } from "@/lib/validation-schemas/dashboard";
import { getDashboardStatsService } from "@/services/dashboard-service";
import { searchDashboardService } from "@/services/dashboard-search-service";

/**
 * Entry point for dashboard stat retrieval from server components.
 * Performs schema parsing even for empty input to keep contracts explicit.
 * Returns service output so UI can remain independent of data source details.
 */
export async function getDashboardStats(input?: unknown) {
  const parsed = getDashboardStatsSchema.parse(input ?? {});
  return getDashboardStatsService(parsed);
}

/**
 * Parses a dashboard-global search request and returns cross-module matches.
 * Keeps dashboard search orchestration behind a single action entry point.
 */
export async function searchDashboard(input: unknown) {
  const parsed = dashboardSearchSchema.parse(input);
  return searchDashboardService(parsed);
}