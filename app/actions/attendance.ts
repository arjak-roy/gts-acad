"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentModuleAccess } from "@/lib/auth/access";
import { markAttendanceSchema } from "@/lib/validation-schemas/attendance";
import { markAttendanceService } from "@/services/attendance-service";

/**
 * Validates incoming attendance payloads from client mutations.
 * Persists attendance records through the service abstraction.
 * Revalidates dependent pages so attendance-driven widgets update immediately.
 */
export async function markAttendance(input: unknown) {
  await requireCurrentModuleAccess("attendance");
  const parsed = markAttendanceSchema.parse(input);
  const result = await markAttendanceService(parsed);

  revalidatePath("/learners");
  revalidatePath("/attendance");
  revalidatePath("/dashboard");

  return result;
}