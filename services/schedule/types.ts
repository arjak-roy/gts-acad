import { BatchMode, EvaluationStatus, LiveClassProvider, Prisma, SessionType, TrainerSessionRole } from "@prisma/client";

export type ScheduleEventType = "CLASS" | "TEST";
export type LiveClassProviderType = "MANUAL" | "HMS" | "WEBRTC";
export type ScheduleContextType = "batch" | "learner" | "trainer";
export type SessionTypeValue = "COURSE_SESSION" | "REVIEW_SESSION" | "ASSESSMENT_REVIEW" | "WORKSHOP" | "WEBINAR";
export type TrainerSessionRoleValue = "PRIMARY" | "CO_TRAINER" | "REVIEWER";

export type BatchScheduleEventWhereInput = Record<string, unknown>;

export type ScheduleContextOption = {
  id: string;
  label: string;
  meta: string | null;
};

export type EventRecord = {
  id: string;
  batchId: string;
  linkedAssessmentId: string | null;
  linkedAssessmentPoolId: string | null;
  seriesId: string | null;
  occurrenceIndex: number;
  title: string;
  description: string | null;
  type: ScheduleEventType;
  classMode: BatchMode | null;
  status: EvaluationStatus;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  meetingUrl: string | null;
  liveProvider: LiveClassProvider;
  liveRoomId: string | null;
  liveRoomCode: string | null;
  liveStartedAt: Date | null;
  liveEndedAt: Date | null;
  recurrenceRule: Prisma.JsonValue;
  sessionType: SessionType | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ScheduleEventListItem = {
  id: string;
  batchId: string;
  batchCode: string;
  batchName: string;
  title: string;
  description: string | null;
  type: ScheduleEventType;
  classMode: BatchMode | null;
  status: EvaluationStatus;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  meetingUrl: string | null;
  liveProvider: LiveClassProviderType;
  liveRoomId: string | null;
  liveRoomCode: string | null;
  liveStartedAt: string | null;
  liveEndedAt: string | null;
  linkedAssessmentId: string | null;
  linkedAssessmentPoolId: string | null;
  linkedAssessmentPoolCode: string | null;
  linkedAssessmentPoolTitle: string | null;
  sessionType: SessionTypeValue | null;
  seriesId: string | null;
  occurrenceIndex: number;
  isRecurring: boolean;
};

export type ScheduleEventListResponse = {
  items: ScheduleEventListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type TrainerAssignmentInput = {
  trainerProfileId: string;
  role?: TrainerSessionRoleValue;
};

export type ScheduleEventWithTrainers = ScheduleEventListItem & {
  sessionType: SessionTypeValue | null;
  rescheduleReason: string | null;
  cancellationReason: string | null;
  completedAt: string | null;
  completionNotes: string | null;
  attendanceCount: number | null;
  trainers: Array<{
    id: string;
    trainerProfileId: string;
    trainerName: string;
    employeeCode: string;
    role: string;
  }>;
};
