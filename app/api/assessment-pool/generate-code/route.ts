import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { generateAssessmentPoolCode } from "@/services/assessment-pool-service";

const generateCodeSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title } = generateCodeSchema.parse(body);
    const code = await generateAssessmentPoolCode(title);
    return apiSuccess({ code });
  } catch (error) {
    return apiError(error);
  }
}
