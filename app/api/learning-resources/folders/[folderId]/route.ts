import { requirePermission } from "@/lib/auth/route-guards";
import {
  deleteLearningResourceFolderService,
  updateLearningResourceFolderService,
} from "@/services/learning-resource-service";
import { createFolderUpdateHandler, createFolderDeleteHandler } from "@/app/api/learning-resources/folders/[folderId]/handler";

export const PATCH = createFolderUpdateHandler({
  requirePermission,
  updateFolderService: updateLearningResourceFolderService,
});

export const DELETE = createFolderDeleteHandler({
  requirePermission,
  deleteFolderService: deleteLearningResourceFolderService,
});