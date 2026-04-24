import "server-only";

export {
  assignLearningResourceService,
  createLearningResourceService,
  deleteLearningResourceService,
  getLearningResourceAssetService,
  importCourseContentToLearningResourceService,
  recordLearningResourceUsageService,
  removeLearningResourceAssignmentService,
  restoreDeletedLearningResourceService,
  restoreLearningResourceVersionService,
  syncLearningResourceFromContentService,
  syncLearningResourcesFromContentService,
  updateLearningResourceService,
} from "@/services/learning-resources/commands";
export {
  getLearningResourceByIdService,
  listLearningResourceLookupsService,
  listLearningResourcesService,
  listLearningResourceVersionsService,
  searchLearningResourcesService,
} from "@/services/learning-resources/queries";
export type { LearningResourceSearchItem } from "@/services/learning-resources/queries";
export type {
  LearningResourceAssignmentItem,
  LearningResourceAttachmentItem,
  LearningResourceCategorySummary,
  LearningResourceCreateResult,
  LearningResourceDetail,
  LearningResourceListItem,
  LearningResourceListPage,
  LearningResourceLookups,
  LearningResourceLookupOption,
  LearningResourceTagSummary,
  LearningResourceVersionDetail,
  LearningResourceVersionSnapshot,
  LearningResourceVersionSummary,
} from "@/services/learning-resources/types";
