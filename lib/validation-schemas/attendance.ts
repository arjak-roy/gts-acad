import { z } from "zod";

export const attendanceRowSchema = z.object({
  learnerId: z.string().trim().min(3).max(50),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  notes: z.string().trim().optional(),
});

export const markAttendanceSchema = z.object({
  batchCode: z.string().trim().min(2).max(50),
  sessionDate: z.coerce.date(),
  markedByUserId: z.string().trim().uuid().optional(),
  records: z.array(attendanceRowSchema).min(1).max(100),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;