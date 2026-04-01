import { z } from "zod";

export const getDashboardStatsSchema = z.object({}).default({});

export const dashboardSearchSchema = z.object({
	query: z.string().trim().min(2).max(120),
});

export type GetDashboardStatsInput = z.infer<typeof getDashboardStatsSchema>;
export type DashboardSearchInput = z.infer<typeof dashboardSearchSchema>;