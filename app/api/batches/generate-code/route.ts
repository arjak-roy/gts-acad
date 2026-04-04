import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { generateBatchCode } from "@/services/batches-service";
import { z } from "zod";

const generateCodeSchema = z.object({
  programName: z.string().trim().min(1, "Program name is required"),
});

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "batches.create");
    const body = await request.json();
    const { programName } = generateCodeSchema.parse(body);
    const code = await generateBatchCode(programName);
    return apiSuccess({ code });
  } catch (error) {
    return apiError(error);
  }
}
