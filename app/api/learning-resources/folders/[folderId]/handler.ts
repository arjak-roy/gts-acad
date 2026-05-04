import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import {
  learningResourceFolderIdSchema,
  updateLearningResourceFolderSchema,
} from "@/lib/validation-schemas/learning-resources";
import type { LearningResourceFolderSummary } from "@/services/learning-resources/types";

type Session = { userId: string };
type RouteContext = { params: { folderId: string } };

export type FolderUpdateDependencies = {
  requirePermission: (request: NextRequest, permission: string) => Promise<Session>;
  updateFolderService: (
    input: { folderId: string; name?: string; parentId?: string | null; description?: string; sortOrder?: number },
    options?: { actorUserId?: string },
  ) => Promise<LearningResourceFolderSummary>;
};

export type FolderDeleteDependencies = {
  requirePermission: (request: NextRequest, permission: string) => Promise<Session>;
  deleteFolderService: (
    folderId: string,
    options?: { actorUserId?: string },
  ) => Promise<void>;
};

export function createFolderUpdateHandler(deps: FolderUpdateDependencies) {
  return async function PATCH(request: NextRequest, { params }: RouteContext) {
    try {
      const session = await deps.requirePermission(request, "learning_resources.edit");
      const body = await request.json();
      const input = updateLearningResourceFolderSchema.parse({ ...body, folderId: params.folderId });
      const folder = await deps.updateFolderService(input, { actorUserId: session.userId });
      return apiSuccess(folder);
    } catch (error) {
      return apiError(error);
    }
  };
}

export function createFolderDeleteHandler(deps: FolderDeleteDependencies) {
  return async function DELETE(request: NextRequest, { params }: RouteContext) {
    try {
      const session = await deps.requirePermission(request, "learning_resources.delete");
      const { folderId } = learningResourceFolderIdSchema.parse(params);
      await deps.deleteFolderService(folderId, { actorUserId: session.userId });
      return apiSuccess({ success: true });
    } catch (error) {
      return apiError(error);
    }
  };
}
