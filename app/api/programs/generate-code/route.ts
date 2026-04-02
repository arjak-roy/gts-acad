import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { generateProgramCode } from "@/services/programs-service";

const generateProgramCodeSchema = z.object({
  programName: z.string().trim().min(1, "Program name is required."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { programName } = generateProgramCodeSchema.parse(body);
    const code = await generateProgramCode(programName);
    return apiSuccess({ code });
  } catch (error) {
    return apiError(error);
  }
}