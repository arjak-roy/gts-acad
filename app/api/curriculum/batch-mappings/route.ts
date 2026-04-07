import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import {
  assignCurriculumToBatchSchema,
  removeCurriculumFromBatchSchema,
} from "@/lib/validation-schemas/curriculum";
import {
  assignCurriculumToBatchService,
  getCurriculumBatchMappingsService,
  removeCurriculumFromBatchService,
} from "@/services/curriculum-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "curriculum.view");
    const curriculumId = String(request.nextUrl.searchParams.get("curriculumId") ?? "").trim();

    if (!curriculumId) {
      throw new Error("Curriculum ID is required.");
    }

    const batchMappings = await getCurriculumBatchMappingsService(curriculumId);
    return apiSuccess(batchMappings);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "curriculum.edit");
    const body = await request.json();
    const input = assignCurriculumToBatchSchema.parse(body);
    await assignCurriculumToBatchService(input, { actorUserId: session.userId });
    return apiSuccess({ success: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requirePermission(request, "curriculum.edit");
    const body = await request.json();
    const input = removeCurriculumFromBatchSchema.parse(body);
    await removeCurriculumFromBatchService(input, { actorUserId: session.userId });
    return apiSuccess({ success: true });
  } catch (error) {
    return apiError(error);
  }
}