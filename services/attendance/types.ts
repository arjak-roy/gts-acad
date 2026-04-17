export type AttendanceStatusValue = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export type AttendanceSessionSourceValue = "MANUAL" | "SCHEDULE_EVENT";

export type AttendanceWorkspaceBatchOption = {
  id: string;
  code: string;
  name: string;
  programName: string;
  campus: string | null;
  status: string;
};

export type AttendanceWorkspaceBatchSummary = {
  id: string;
  code: string;
  name: string;
  programName: string;
  campus: string | null;
  activeLearnerCount: number;
};

export type AttendanceWorkspaceSessionSummary = {
  id: string;
  sourceType: AttendanceSessionSourceValue;
  sessionDate: string;
  title: string | null;
  linkedScheduleEventId: string | null;
  existingRecordCount: number;
  updatedAt: string;
  createdByName: string | null;
};

export type AttendanceScheduledEventSummary = {
  id: string;
  title: string;
  type: "CLASS" | "TEST";
  status: string;
  classMode: "ONLINE" | "OFFLINE" | null;
  startsAt: string;
  endsAt: string | null;
};

export type AttendanceWorkspaceRow = {
  enrollmentId: string;
  learnerId: string;
  learnerCode: string;
  learnerName: string;
  attendancePercentage: number;
  readinessPercentage: number;
  existingStatus: AttendanceStatusValue | null;
  existingNotes: string | null;
};

export type AttendanceWorkspaceSummary = {
  totalLearners: number;
  markedCount: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
};

export type AttendanceWorkspaceData = {
  batch: AttendanceWorkspaceBatchSummary;
  selection: {
    sessionDate: string;
    sessionSourceType: AttendanceSessionSourceValue;
    scheduleEventId: string | null;
  };
  session: AttendanceWorkspaceSessionSummary | null;
  scheduledEvents: AttendanceScheduledEventSummary[];
  roster: AttendanceWorkspaceRow[];
  summary: AttendanceWorkspaceSummary;
};