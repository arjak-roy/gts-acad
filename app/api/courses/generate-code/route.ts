import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { generateCourseCode } from "@/services/courses-service";

const generateCourseCodeSchema = z.object({
  courseName: z.string().trim().min(1, "Course name is required."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { courseName } = generateCourseCodeSchema.parse(body);
    const code = await generateCourseCode(courseName);
    return apiSuccess({ code });
  } catch (error) {
    return apiError(error);
  }
}