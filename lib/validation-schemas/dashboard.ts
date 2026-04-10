import { z } from "zod";

const dashboardProgramTypeSchema = z.enum(["LANGUAGE", "CLINICAL", "TECHNICAL"]).optional();
const dashboardFilterIdSchema = z.string().trim().min(1).optional();

export const getDashboardStatsSchema = z.object({
	programType: dashboardProgramTypeSchema,
	courseId: dashboardFilterIdSchema,
	programId: dashboardFilterIdSchema,
	batchId: dashboardFilterIdSchema,
}).default({});

export const dashboardSearchSchema = z.object({
	query: z.string().trim().min(2).max(120),
});

export type GetDashboardStatsInput = z.infer<typeof getDashboardStatsSchema>;
export type DashboardSearchInput = z.infer<typeof dashboardSearchSchema>;