import "server-only";

export {
  assignLearningResourceService,
  createLearningResourceService,
  deleteLearningResourceService,
  getLearningResourceAssetService,
  importCourseContentToLearningResourceService,
  recordLearningResourceUsageService,
  removeLearningResourceAssignmentService,
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
} from "@/services/learning-resources/queries";
export type {
  LearningResourceAssignmentItem,
  LearningResourceAttachmentItem,
  LearningResourceCategorySummary,
  LearningResourceCreateResult,
  LearningResourceDetail,
  LearningResourceListItem,
  LearningResourceLookups,
  LearningResourceLookupOption,
  LearningResourceTagSummary,
  LearningResourceVersionDetail,
  LearningResourceVersionSnapshot,
  LearningResourceVersionSummary,
} from "@/services/learning-resources/types";
