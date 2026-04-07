import "server-only";

export {
	assignCurriculumToBatchService,
	createCurriculumModuleService,
	createCurriculumService,
	createCurriculumStageItemService,
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
	getCurriculaForBatchService,
	getCurriculumBatchMappingsService,
	getCurriculumByIdService,
	listCurriculaByCourseService,
} from "@/services/curriculum/queries";

export type {
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