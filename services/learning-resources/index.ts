import "server-only";

export {
  assignLearningResourceService,
  createLearningResourceFolderService,
  createLearningResourceService,
  deleteLearningResourceFolderService,
  deleteLearningResourceService,
  getLearningResourceAssetService,
  importCourseContentToLearningResourceService,
  recordLearningResourceUsageService,
  removeLearningResourceAssignmentService,
  restoreDeletedLearningResourceService,
  restoreLearningResourceVersionService,
  syncLearningResourceFromContentService,
  syncLearningResourcesFromContentService,
  updateLearningResourceFolderService,
  updateLearningResourceService,
} from "@/services/learning-resources/commands";
export {
  getLearningResourceByIdService,
  listAllAssignmentsService,
  listCurriculumLearningResourceReferencesService,
  listLearningResourceLookupsService,
  listLearningResourcesService,
  listLearningResourceVersionsService,
  searchLearningResourcesService,
} from "@/services/learning-resources/queries";
export type { AssignmentListItem, AssignmentListPage, LearningResourceSearchItem } from "@/services/learning-resources/queries";
export type {
  CurriculumLearningResourceReferenceItem,
  CurriculumLearningResourceReferences,
  LearningResourceAssignmentItem,
  LearningResourceAttachmentItem,
  LearningResourceCategorySummary,
  LearningResourceCreateResult,
  LearningResourceDetail,
  LearningResourceFolderSummary,
  LearningResourceListItem,
  LearningResourceListPage,
  LearningResourceLookups,
  LearningResourceLookupOption,
  LearningResourceTagSummary,
  LearningResourceVersionDetail,
  LearningResourceVersionSnapshot,
  LearningResourceVersionSummary,
} from "@/services/learning-resources/types";
