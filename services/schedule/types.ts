import { BatchMode, EvaluationStatus, LiveClassProvider, Prisma } from "@prisma/client";

export type ScheduleEventType = "CLASS" | "TEST";
export type LiveClassProviderType = "MANUAL" | "HMS";
export type ScheduleContextType = "batch" | "learner" | "trainer";

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
