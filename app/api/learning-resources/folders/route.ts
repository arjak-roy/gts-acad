import { requirePermission } from "@/lib/auth/route-guards";
import {
  createLearningResourceFolderService,
  listLearningResourceLookupsService,
} from "@/services/learning-resource-service";
import { createFolderListHandler, createFolderCreateHandler } from "@/app/api/learning-resources/folders/handler";

export const GET = createFolderListHandler({
  requirePermission,
  listFoldersService: async () => {
    const lookups = await listLearningResourceLookupsService();
    return lookups.folders;
  },
});

export const POST = createFolderCreateHandler({
  requirePermission,
  createFolderService: createLearningResourceFolderService,
});