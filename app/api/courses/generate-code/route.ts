import { z } from "zod";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireRequestModuleAccess } from "@/lib/auth/access";
import { generateCourseCode } from "@/services/courses-service";

const generateCourseCodeSchema = z.object({
  courseName: z.string().trim().min(1, "Course name is required."),
});

export async function POST(request: NextRequest) {
  try {
    await requireRequestModuleAccess(request, "courses");
    const body = await request.json();
    const { courseName } = generateCourseCodeSchema.parse(body);
    const code = await generateCourseCode(courseName);
    return apiSuccess({ code });
  } catch (error) {
    return apiError(error);
  }
}