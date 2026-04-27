import { z } from "zod";

const scheduleEventTypeSchema = z.enum(["CLASS", "TEST"]);
const scheduleEventStatusSchema = z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "RESCHEDULED"]);
const classModeSchema = z.enum(["ONLINE", "OFFLINE"]);
const liveClassProviderSchema = z.enum(["MANUAL", "HMS"]);
const recurrenceFrequencySchema = z.enum(["DAILY", "WEEKLY", "MONTHLY"]);
const scheduleUpdateScopeSchema = z.enum(["SINGLE", "THIS_AND_FUTURE", "SERIES"]);
const scheduleContextTypeSchema = z.enum(["batch", "learner", "trainer"]);
const sessionTypeSchema = z.enum(["COURSE_SESSION", "REVIEW_SESSION", "ASSESSMENT_REVIEW", "WORKSHOP", "WEBINAR"]);
const trainerSessionRoleSchema = z.enum(["PRIMARY", "CO_TRAINER", "REVIEWER"]);

const recurrenceRuleSchema = z
  .object({
    frequency: recurrenceFrequencySchema,
    interval: z.coerce.number().int().min(1).max(12).optional().default(1),
    count: z.coerce.number().int().min(1).max(180).optional(),
    until: z.string().trim().datetime().optional(),
    byWeekdays: z.array(z.coerce.number().int().min(0).max(6)).optional().default([]),
  })
  .refine((value) => value.count !== undefined || Boolean(value.until), {
    message: "Recurring events require either count or until.",
    path: ["count"],
  });

export const createScheduleEventSchema = z
  .object({
    batchId: z.string().trim().min(1),
    title: z.string().trim().min(2).max(255),
    description: z.string().trim().max(5000).optional().default(""),
    type: scheduleEventTypeSchema,
    classMode: classModeSchema.optional(),
    status: scheduleEventStatusSchema.optional().default("SCHEDULED"),
    startsAt: z.string().trim().datetime(),
    endsAt: z.string().trim().datetime().optional(),
    location: z.string().trim().max(255).optional().default(""),
    meetingUrl: z.string().trim().url().max(1000).optional().or(z.literal("")).default(""),
    liveProvider: liveClassProviderSchema.optional().default("MANUAL"),
    linkedAssessmentPoolId: z.string().trim().min(1).optional().nullable(),
    sessionType: sessionTypeSchema.optional(),
    trainers: z.array(z.object({
      trainerProfileId: z.string().trim().min(1),
      role: trainerSessionRoleSchema.optional().default("PRIMARY"),
    })).optional().default([]),
    recurrence: recurrenceRuleSchema.optional(),
  })
  .refine((value) => (value.type === "CLASS" ? Boolean(value.classMode) : true), {
    message: "Class mode is required for class events.",
    path: ["classMode"],
  })
  .refine((value) => {
    if (!value.endsAt) {
      return true;
    }

    return new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime();
  }, {
    message: "End time must be after start time.",
    path: ["endsAt"],
  });

export const updateScheduleEventSchema = z
  .object({
    eventId: z.string().trim().min(1),
    title: z.string().trim().min(2).max(255).optional(),
    description: z.string().trim().max(5000).optional(),
    type: scheduleEventTypeSchema.optional(),
    classMode: classModeSchema.nullable().optional(),
    status: scheduleEventStatusSchema.optional(),
    startsAt: z.string().trim().datetime().optional(),
    endsAt: z.string().trim().datetime().nullable().optional(),
    location: z.string().trim().max(255).optional(),
    meetingUrl: z.string().trim().url().max(1000).or(z.literal("")).nullable().optional(),
    liveProvider: liveClassProviderSchema.optional(),
    linkedAssessmentPoolId: z.string().trim().min(1).nullable().optional(),
    sessionType: sessionTypeSchema.nullable().optional(),
    scope: scheduleUpdateScopeSchema.optional().default("SINGLE"),
  })
  .refine((value) => {
    if (!value.startsAt || !value.endsAt) {
      return true;
    }

    return new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime();
  }, {
    message: "End time must be after start time.",
    path: ["endsAt"],
  });

export const listScheduleEventsQuerySchema = z
  .object({
    contextType: scheduleContextTypeSchema.optional().default("batch"),
    batchId: z.string().trim().min(1).optional(),
    learnerId: z.string().trim().min(1).optional(),
    trainerId: z.string().trim().min(1).optional(),
    from: z.string().trim().datetime().optional(),
    to: z.string().trim().datetime().optional(),
    type: scheduleEventTypeSchema.optional(),
    status: scheduleEventStatusSchema.optional(),
    search: z.string().trim().max(255).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(500).optional().default(100),
  })
  .refine((value) => {
    if (!value.from || !value.to) {
      return true;
    }

    return new Date(value.to).getTime() > new Date(value.from).getTime();
  }, {
    message: "Query range end must be after start.",
    path: ["to"],
  })
  .refine((value) => {
    if (value.contextType === "learner") {
      return Boolean(value.learnerId);
    }

    if (value.contextType === "trainer") {
      return Boolean(value.trainerId);
    }

    return true;
  }, {
    message: "A learner or trainer selection is required for this schedule view.",
    path: ["contextType"],
  });

export const cancelScheduleEventSchema = z.object({
  eventId: z.string().trim().min(1),
  scope: scheduleUpdateScopeSchema.optional().default("SINGLE"),
});

export type CreateScheduleEventInput = z.infer<typeof createScheduleEventSchema>;
export type UpdateScheduleEventInput = z.infer<typeof updateScheduleEventSchema>;
export type ListScheduleEventsQueryInput = z.infer<typeof listScheduleEventsQuerySchema>;
export type CancelScheduleEventInput = z.infer<typeof cancelScheduleEventSchema>;
export type ScheduleContextTypeInput = z.infer<typeof scheduleContextTypeSchema>;

// ── Trainer Session Schemas ────────────────────────────────────

export const rescheduleSessionSchema = z.object({
  startsAt: z.string().trim().datetime(),
  endsAt: z.string().trim().datetime().nullable().optional(),
  reason: z.string().trim().min(2).max(1000),
}).refine((value) => {
  if (!value.endsAt) return true;
  return new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime();
}, { message: "End time must be after start time.", path: ["endsAt"] });

export const cancelSessionSchema = z.object({
  reason: z.string().trim().min(2).max(1000),
});

export const completeSessionSchema = z.object({
  completionNotes: z.string().trim().max(2000).optional().nullable(),
  attendanceCount: z.coerce.number().int().min(0).optional().nullable(),
});

export const assignTrainerSchema = z.object({
  trainerProfileId: z.string().trim().min(1),
  role: trainerSessionRoleSchema.optional().default("PRIMARY"),
});

export const updateTrainerRoleSchema = z.object({
  role: trainerSessionRoleSchema,
});

export const conflictCheckSchema = z.object({
  trainerProfileId: z.string().trim().min(1),
  startsAt: z.string().trim().datetime(),
  endsAt: z.string().trim().datetime(),
  excludeEventId: z.string().trim().min(1).optional(),
});

export type RescheduleSessionInput = z.infer<typeof rescheduleSessionSchema>;
export type CancelSessionInput = z.infer<typeof cancelSessionSchema>;
export type CompleteSessionInput = z.infer<typeof completeSessionSchema>;
export type AssignTrainerInput = z.infer<typeof assignTrainerSchema>;
export type UpdateTrainerRoleInput = z.infer<typeof updateTrainerRoleSchema>;
export type ConflictCheckInput = z.infer<typeof conflictCheckSchema>;
