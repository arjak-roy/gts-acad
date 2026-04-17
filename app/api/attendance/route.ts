import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { markAttendanceSchema } from "@/lib/validation-schemas/attendance";
import { markAttendanceService } from "@/services/attendance-service";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "attendance.manage");
    const body = await request.json();
    const input = markAttendanceSchema.parse(body);
    const result = await markAttendanceService(input, { actorUserId: session.userId });

    revalidatePath("/learners");
    revalidatePath("/attendance");
    revalidatePath("/dashboard");

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}