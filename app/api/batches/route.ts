import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireRequestModuleAccess } from "@/lib/auth/access";
import { createBatchSchema } from "@/lib/validation-schemas/batches";
import { createBatchService, listBatchesService } from "@/services/batches-service";

export async function GET(request: NextRequest) {
  try {
    await requireRequestModuleAccess(request, "batches");
    const { searchParams } = new URL(request.url);
    const programName = searchParams.get("programName") ?? undefined;
    const batches = await listBatchesService(programName);
    return apiSuccess(batches);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRequestModuleAccess(request, "batches");
    const body = await request.json();
    const input = createBatchSchema.parse(body);
    const batch = await createBatchService(input);
    return apiSuccess(batch, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
