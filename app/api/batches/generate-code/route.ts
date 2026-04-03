import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireRequestModuleAccess } from "@/lib/auth/access";
import { generateBatchCode } from "@/services/batches-service";
import { z } from "zod";

const generateCodeSchema = z.object({
  programName: z.string().trim().min(1, "Program name is required"),
});

export async function POST(request: NextRequest) {
  try {
    await requireRequestModuleAccess(request, "batches");
    const body = await request.json();
    const { programName } = generateCodeSchema.parse(body);
    const code = await generateBatchCode(programName);
    return apiSuccess({ code });
  } catch (error) {
    return apiError(error);
  }
}
