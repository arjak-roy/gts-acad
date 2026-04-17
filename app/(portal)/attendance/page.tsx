import { AttendanceWorkspace } from "@/components/modules/attendance/attendance-workspace";
import { listBatchesService } from "@/services/batches-service";
import type { AttendanceWorkspaceBatchOption } from "@/services/attendance/types";

type AttendancePageProps = {
  searchParams?: {
    batchCode?: string | string[];
    sessionDate?: string | string[];
    sessionSourceType?: "MANUAL" | "SCHEDULE_EVENT" | Array<"MANUAL" | "SCHEDULE_EVENT">;
    scheduleEventId?: string | string[];
  };
};

function firstQueryValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSessionSourceType(value?: "MANUAL" | "SCHEDULE_EVENT" | Array<"MANUAL" | "SCHEDULE_EVENT">) {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  return normalizedValue === "SCHEDULE_EVENT" ? normalizedValue : normalizedValue === "MANUAL" ? normalizedValue : undefined;
}

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const batches = await listBatchesService();

  const initialBatches: AttendanceWorkspaceBatchOption[] = batches.map((batch) => ({
    id: batch.id,
    code: batch.code,
    name: batch.name,
    programName: batch.programName,
    campus: batch.campus,
    status: batch.status,
  }));

  const initialSelection = {
    batchCode: firstQueryValue(searchParams?.batchCode),
    sessionDate: firstQueryValue(searchParams?.sessionDate),
    sessionSourceType: normalizeSessionSourceType(searchParams?.sessionSourceType),
    scheduleEventId: firstQueryValue(searchParams?.scheduleEventId),
  };

  return (
    <AttendanceWorkspace
      initialBatches={initialBatches}
      initialSelection={initialSelection}
    />
  );
}