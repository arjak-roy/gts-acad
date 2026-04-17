import { AttendanceWorkspace } from "@/components/modules/attendance/attendance-workspace";
import { listBatchesService } from "@/services/batches-service";
import type { AttendanceWorkspaceBatchOption } from "@/services/attendance/types";

type AttendancePageProps = {
  searchParams?: {
    batchCode?: string;
    sessionDate?: string;
    sessionSourceType?: "MANUAL" | "SCHEDULE_EVENT";
    scheduleEventId?: string;
  };
};

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

  return (
    <AttendanceWorkspace
      initialBatches={initialBatches}
      initialSelection={{
        batchCode: searchParams?.batchCode,
        sessionDate: searchParams?.sessionDate,
        sessionSourceType: searchParams?.sessionSourceType,
        scheduleEventId: searchParams?.scheduleEventId,
      }}
    />
  );
}