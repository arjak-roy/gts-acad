import { BatchMode, EvaluationStatus, Prisma } from "@prisma/client";

export type ScheduleEventType = "CLASS" | "TEST" | "QUIZ" | "CONTEST";

export type BatchScheduleEventWhereInput = Record<string, unknown>;

export type EventRecord = {
  id: string;
  batchId: string;
  linkedAssessmentId: string | null;
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
  linkedAssessmentId: string | null;
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
