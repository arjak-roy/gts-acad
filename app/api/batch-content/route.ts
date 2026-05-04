import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import {
  assignContentToBatchSchema,
  removeContentFromBatchSchema,
  assignAssessmentToBatchSchema,
  removeAssessmentFromBatchSchema,
} from "@/lib/validation-schemas/batch-content";
import {
  listBatchContentService,
  listBatchAssessmentsService,
  assignContentToBatchService,
  removeContentFromBatchService,
  assignAssessmentToBatchService,
  removeAssessmentFromBatchService,
  getAvailableContentForBatchService,
  getAvailableAssessmentsForBatchService,
} from "@/services/batch-content-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "batch_content.view");
    const batchId = request.nextUrl.searchParams.get("batchId");
    const type = request.nextUrl.searchParams.get("type") || "content";
    const available = request.nextUrl.searchParams.get("available") === "true";

    if (!batchId) throw new Error("Missing batchId parameter.");

    if (available) {
      if (type === "assessment") {
        const items = await getAvailableAssessmentsForBatchService(batchId);
        return apiSuccess(items);
      }
      const items = await getAvailableContentForBatchService(batchId);
      return apiSuccess(items);
    }

    if (type === "assessment") {
      const items = await listBatchAssessmentsService(batchId);
      return apiSuccess(items);
    }

    const items = await listBatchContentService(batchId, { includeAssignedResources: true });
    return apiSuccess(items);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "batch_content.assign");
    const body = await request.json();
    const type = body.type || "content";

    if (type === "assessment") {
      const input = assignAssessmentToBatchSchema.parse(body);
      const count = await assignAssessmentToBatchService(input, { actorUserId: session.userId });
      return apiSuccess({ assigned: count }, { status: 201 });
    }

    const input = assignContentToBatchSchema.parse(body);
    const count = await assignContentToBatchService(input, { actorUserId: session.userId });
    return apiSuccess({ assigned: count }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requirePermission(request, "batch_content.remove");
    const body = await request.json();
    const type = body.type || "content";

    if (type === "assessment") {
      const input = removeAssessmentFromBatchSchema.parse(body);
      await removeAssessmentFromBatchService(input);
      return apiSuccess({ removed: true });
    }

    const input = removeContentFromBatchSchema.parse(body);
    await removeContentFromBatchService(input);
    return apiSuccess({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
