import { z } from "zod";

export const attendanceRowSchema = z.object({
  learnerId: z.string().trim().min(3).max(50),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  notes: z.string().trim().optional(),
});

export const attendanceSessionSourceSchema = z.enum(["MANUAL", "SCHEDULE_EVENT"]);

export const attendanceSessionSelectionSchema = z.object({
  batchCode: z.string().trim().min(2).max(50),
  sessionDate: z.coerce.date(),
  sessionSourceType: attendanceSessionSourceSchema.default("MANUAL"),
  scheduleEventId: z.string().trim().uuid().optional(),
});

export const attendanceWorkspaceQuerySchema = attendanceSessionSelectionSchema;

export const markAttendanceSchema = attendanceSessionSelectionSchema
  .extend({
    markedByUserId: z.string().trim().uuid().optional(),
    sessionLabel: z.string().trim().max(255).optional(),
    records: z.array(attendanceRowSchema).min(1).max(300),
  })
  .superRefine((value, context) => {
    if (value.sessionSourceType === "SCHEDULE_EVENT" && !value.scheduleEventId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A schedule event is required for schedule-linked attendance.",
        path: ["scheduleEventId"],
      });
    }
  });

export type AttendanceSessionSelectionInput = z.infer<typeof attendanceSessionSelectionSchema>;
export type AttendanceWorkspaceQueryInput = z.infer<typeof attendanceWorkspaceQuerySchema>;

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;