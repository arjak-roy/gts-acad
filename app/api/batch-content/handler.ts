import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import {
  assignContentToBatchSchema,
  removeContentFromBatchSchema,
} from "@/lib/validation-schemas/batch-content";
import type { BatchContentItem, BatchAvailableContentItem } from "@/services/batch-content/types";

type Session = { userId: string };

export type BatchContentListDependencies = {
  requirePermission: (request: NextRequest, permission: string) => Promise<Session>;
  listBatchContentService: (batchId: string, options?: { includeAssignedResources?: boolean }) => Promise<BatchContentItem[]>;
  getAvailableContentForBatchService: (batchId: string) => Promise<BatchAvailableContentItem[]>;
};

export type BatchContentAssignDependencies = {
  requirePermission: (request: NextRequest, permission: string) => Promise<Session>;
  assignContentToBatchService: (
    input: { batchId: string; contentIds: string[]; resourceIds: string[] },
    options?: { actorUserId?: string },
  ) => Promise<number>;
};

export type BatchContentRemoveDependencies = {
  requirePermission: (request: NextRequest, permission: string) => Promise<Session>;
  removeContentFromBatchService: (
    input: { batchId: string; contentId?: string | null; resourceId?: string | null; assignmentId?: string | null },
  ) => Promise<void>;
};

export function createBatchContentListHandler(deps: BatchContentListDependencies) {
  return async function GET(request: NextRequest) {
    try {
      await deps.requirePermission(request, "batch_content.view");
      const batchId = request.nextUrl.searchParams.get("batchId");
      const available = request.nextUrl.searchParams.get("available") === "true";

      if (!batchId) throw new Error("Missing batchId parameter.");

      if (available) {
        const items = await deps.getAvailableContentForBatchService(batchId);
        return apiSuccess(items);
      }

      const items = await deps.listBatchContentService(batchId, { includeAssignedResources: true });
      return apiSuccess(items);
    } catch (error) {
      return apiError(error);
    }
  };
}

export function createBatchContentAssignHandler(deps: BatchContentAssignDependencies) {
  return async function POST(request: NextRequest) {
    try {
      const session = await deps.requirePermission(request, "batch_content.assign");
      const body = await request.json();
      const input = assignContentToBatchSchema.parse(body);
      const count = await deps.assignContentToBatchService(input, { actorUserId: session.userId });
      return apiSuccess({ assigned: count }, { status: 201 });
    } catch (error) {
      return apiError(error);
    }
  };
}

export function createBatchContentRemoveHandler(deps: BatchContentRemoveDependencies) {
  return async function DELETE(request: NextRequest) {
    try {
      await deps.requirePermission(request, "batch_content.remove");
      const body = await request.json();
      const input = removeContentFromBatchSchema.parse(body);
      await deps.removeContentFromBatchService(input);
      return apiSuccess({ removed: true });
    } catch (error) {
      return apiError(error);
    }
  };
}
