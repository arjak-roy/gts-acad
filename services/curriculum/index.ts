import "server-only";

export {
	assignCurriculumToBatchService,
	createCurriculumModuleService,
	createCurriculumService,
	createCurriculumStageItemService,
	createCurriculumStageItemsService,
	createCurriculumStageService,
	deleteCurriculumModuleService,
	deleteCurriculumService,
	deleteCurriculumStageItemService,
	deleteCurriculumStageService,
	removeCurriculumFromBatchService,
	reorderCurriculumModulesService,
	reorderCurriculumStageItemsService,
	reorderCurriculumStagesService,
	updateCurriculumModuleService,
	updateCurriculumService,
	updateCurriculumStageItemService,
	updateCurriculumStageService,
} from "@/services/curriculum/commands";
export {
	getCandidateCurriculaForBatchService,
	getCurriculaForBatchService,
	getCurriculumBatchMappingsService,
	getCurriculumByIdService,
	listCurriculaByCourseService,
} from "@/services/curriculum/queries";
export {
	listCurriculumItemProgressForLearnerService,
	markCurriculumAssessmentCompletedForLearnerService,
	markCurriculumAssessmentInProgressForLearnerService,
	markCurriculumContentInProgressForLearnerService,
} from "@/services/curriculum/progress";

export type {
	CurriculumAssignmentSource,
	BatchAssignedCurriculumDetail,
	BatchCurriculumWorkspace,
	CurriculumBatchMappingItem,
	CurriculumCreateResult,
	CurriculumDetail,
	CurriculumModuleMutationResult,
	CurriculumModuleSummary,
	CurriculumStageItemDetail,
	CurriculumStageItemMutationResult,
	CurriculumStageMutationResult,
	CurriculumStageSummary,
	CurriculumSummary,
} from "@/services/curriculum/types";