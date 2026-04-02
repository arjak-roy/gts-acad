import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireRequestModuleAccess } from "@/lib/auth/access";
import { markAttendanceSchema } from "@/lib/validation-schemas/attendance";
import { markAttendanceService } from "@/services/attendance-service";

/**
 * Accepts attendance mutation payloads from first- and third-party clients.
 * Validates and persists records via the shared attendance service.
 * Revalidates affected portal routes after a successful write.
 */
export async function POST(request: NextRequest) {
  try {
    await requireRequestModuleAccess(request, "attendance");
    const body = await request.json();
    const input = markAttendanceSchema.parse(body);
    const result = await markAttendanceService(input);

    revalidatePath("/learners");
    revalidatePath("/attendance");
    revalidatePath("/dashboard");

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}