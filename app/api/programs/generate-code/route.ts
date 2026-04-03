import { z } from "zod";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireRequestModuleAccess } from "@/lib/auth/access";
import { generateProgramCode } from "@/services/programs-service";

const generateProgramCodeSchema = z.object({
  programName: z.string().trim().min(1, "Program name is required."),
});

export async function POST(request: NextRequest) {
  try {
    await requireRequestModuleAccess(request, "programs");
    const body = await request.json();
    const { programName } = generateProgramCodeSchema.parse(body);
    const code = await generateProgramCode(programName);
    return apiSuccess({ code });
  } catch (error) {
    return apiError(error);
  }
}