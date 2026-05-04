import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { createLearningResourceFolderSchema } from "@/lib/validation-schemas/learning-resources";
import type { LearningResourceFolderSummary } from "@/services/learning-resources/types";

type Session = { userId: string };

export type FolderRouteListDependencies = {
  requirePermission: (request: NextRequest, permission: string) => Promise<Session>;
  listFoldersService: () => Promise<LearningResourceFolderSummary[]>;
};

export type FolderRouteCreateDependencies = {
  requirePermission: (request: NextRequest, permission: string) => Promise<Session>;
  createFolderService: (
    input: { name: string; description: string; parentId?: string | null; sortOrder?: number },
    options?: { actorUserId?: string },
  ) => Promise<LearningResourceFolderSummary>;
};

export function createFolderListHandler(deps: FolderRouteListDependencies) {
  return async function GET(request: NextRequest) {
    try {
      await deps.requirePermission(request, "learning_resources.view");
      const folders = await deps.listFoldersService();
      return apiSuccess(folders);
    } catch (error) {
      return apiError(error);
    }
  };
}

export function createFolderCreateHandler(deps: FolderRouteCreateDependencies) {
  return async function POST(request: NextRequest) {
    try {
      const session = await deps.requirePermission(request, "learning_resources.create");
      const body = await request.json();
      const input = createLearningResourceFolderSchema.parse(body);
      const folder = await deps.createFolderService(input, { actorUserId: session.userId });
      return apiSuccess(folder, { status: 201 });
    } catch (error) {
      return apiError(error);
    }
  };
}
