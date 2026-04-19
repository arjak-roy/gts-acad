import "server-only";

export {
	assignCurriculumToBatchService,
	cloneCurriculumService,
	createCurriculumFromTemplateService,
	createCurriculumModuleService,
	createCurriculumService,
	createCurriculumStageItemService,
	createCurriculumStageItemsService,
	createCurriculumStageService,
	deleteCurriculumModuleService,
	deleteCurriculumService,
	deleteCurriculumStageItemService,
	deleteCurriculumStageService,
	releaseCurriculumStageItemForBatchService,
	removeCurriculumFromBatchService,
	reorderCurriculumModulesService,
	reorderCurriculumStageItemsService,
	reorderCurriculumStagesService,
	revokeCurriculumStageItemReleaseForBatchService,
	saveCurriculumAsTemplateService,
	updateCurriculumModuleService,
	updateCurriculumService,
	updateCurriculumStageItemService,
	updateCurriculumStageService,
} from "@/services/curriculum/commands";
export {
	getCandidateCurriculaForBatchService,
	getCurriculaForBatchService,
	getCurriculumHealthReportService,
	getCurriculumBatchMappingsService,
	getCurriculumByIdService,
	listCurriculaByCourseService,
	listCurriculumTemplatesService,
} from "@/services/curriculum/queries";
export {
	buildCandidateCurriculumAssessmentContextMap,
	resolveCandidateAssessmentWindow,
	selectRelevantLinkedAssessmentEvent,
} from "@/services/curriculum/assessment-context";
export type {
	CandidateAssessmentDeadlineSource,
	CandidateCurriculumAssessmentContext,
	ResolvedCandidateAssessmentWindow,
} from "@/services/curriculum/assessment-context";
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