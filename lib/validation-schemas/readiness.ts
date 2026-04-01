import { z } from "zod";

export const syncReadinessStatusSchema = z.object({
  learnerCode: z.string().trim().min(3).max(50),
  destination: z.string().trim().min(3).max(100).default("recruiter-workspace"),
  triggeredByUserId: z.string().trim().uuid().optional(),
});

export type SyncReadinessStatusInput = z.infer<typeof syncReadinessStatusSchema>;