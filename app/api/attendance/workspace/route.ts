import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { attendanceWorkspaceQuerySchema } from "@/lib/validation-schemas/attendance";
import { getAttendanceWorkspaceService } from "@/services/attendance-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "attendance.view");

    const { searchParams } = new URL(request.url);
    const input = attendanceWorkspaceQuerySchema.parse({
      batchCode: searchParams.get("batchCode"),
      sessionDate: searchParams.get("sessionDate"),
      sessionSourceType: searchParams.get("sessionSourceType") ?? undefined,
      scheduleEventId: searchParams.get("scheduleEventId") ?? undefined,
    });

    const result = await getAttendanceWorkspaceService(input);

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}