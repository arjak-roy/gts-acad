import {
  ContentStatus,
  ContentType,
  CurriculumItemReleaseType,
  CurriculumItemType,
  CurriculumProgressStatus,
  CurriculumStatus,
  DifficultyLevel,
  QuestionType,
} from "@prisma/client";

export type CurriculumAssignmentSource = "COURSE" | "BATCH" | "COURSE_AND_BATCH";

export type CurriculumStageItemAvailabilityStatus = "AVAILABLE" | "LOCKED" | "SCHEDULED";

export type CurriculumStageItemAvailabilityReasonType =
  | "AVAILABLE_NOW"
  | "UNLOCKS_AT_DATE"
  | "UNLOCKS_AFTER_BATCH_OFFSET"
  | "WAITING_FOR_PREVIOUS_ITEM"
  | "WAITING_FOR_PASSING_SCORE"
  | "MANUAL_RELEASE_REQUIRED"
  | "MANUALLY_RELEASED";

export type CurriculumStageItemAvailabilityReason = {
  type: CurriculumStageItemAvailabilityReasonType;
  message: string;
  unlocksAt: Date | null;
  prerequisiteStageItemId: string | null;
  prerequisiteTitle: string | null;
  requiredScorePercent: number | null;
  batchOffsetDays: number | null;
};

export type CurriculumStageItemReleaseDetail = {
  releaseType: CurriculumItemReleaseType;
  releaseAt: Date | null;
  releaseOffsetDays: number | null;
  prerequisiteStageItemId: string | null;
  prerequisiteTitle: string | null;
  minimumScorePercent: number | null;
  estimatedDurationMinutes: number | null;
  dueAt: Date | null;
  dueOffsetDays: number | null;
  resolvedUnlockAt: Date | null;
  resolvedDueAt: Date | null;
};

export type CurriculumStageItemBatchManualRelease = {
  isReleased: boolean;
  releasedAt: Date | null;
  releasedByName: string | null;
  note: string | null;
};

export type CurriculumStageItemDetail = {
  id: string;
  itemType: CurriculumItemType;
  contentId: string | null;
  assessmentPoolId: string | null;
  sortOrder: number;
  isRequired: boolean;
  referenceCode: string | null;
  referenceTitle: string;
  referenceDescription: string | null;
  courseName: string | null;
  status: ContentStatus | string | null;
  contentType: ContentType | null;
  questionType: QuestionType | null;
  difficultyLevel: DifficultyLevel | null;
  folderName: string | null;
  progressStatus: CurriculumProgressStatus;
  progressPercent: number;
  startedAt: Date | null;
  completedAt: Date | null;
  availabilityStatus: CurriculumStageItemAvailabilityStatus;
  availabilityReason: CurriculumStageItemAvailabilityReason;
  release: CurriculumStageItemReleaseDetail;
  batchManualRelease: CurriculumStageItemBatchManualRelease | null;
};

export type CurriculumStageSummary = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  itemCount: number;
  items: CurriculumStageItemDetail[];
};

export type CurriculumModuleSummary = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  stageCount: number;
  itemCount: number;
  stages: CurriculumStageSummary[];
};

export type CurriculumSummary = {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  title: string;
  description: string | null;
  status: CurriculumStatus;
  moduleCount: number;
  stageCount: number;
  itemCount: number;
  batchCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CurriculumDetail = CurriculumSummary & {
  createdByName: string | null;
  modules: CurriculumModuleSummary[];
};

export type CurriculumCreateResult = {
  id: string;
  courseId: string;
  title: string;
  status: CurriculumStatus;
};

export type CurriculumModuleMutationResult = {
  id: string;
  curriculumId: string;
  title: string;
  sortOrder: number;
};

export type CurriculumStageMutationResult = {
  id: string;
  moduleId: string;
  title: string;
  sortOrder: number;
};

export type CurriculumStageItemMutationResult = {
  id: string;
  stageId: string;
  itemType: CurriculumItemType;
  contentId: string | null;
  assessmentPoolId: string | null;
  sortOrder: number;
  isRequired: boolean;
};

export type CurriculumBatchMappingItem = {
  mappingId: string | null;
  batchId: string;
  batchCode: string;
  batchName: string;
  programId: string;
  programName: string;
  campus: string | null;
  status: string;
  startDate: Date;
  endDate: Date | null;
  isMapped: boolean;
  hasEffectiveAccess: boolean;
  assignedAt: Date | null;
  assignedByName: string | null;
  assignmentSource: CurriculumAssignmentSource;
  isInheritedFromCourse: boolean;
  canRemoveBatchMapping: boolean;
  canAddBatchMapping: boolean;
};

export type BatchAssignedCurriculumDetail = {
  mappingId: string;
  assignedAt: Date;
  assignedByName: string | null;
  assignmentSource: CurriculumAssignmentSource;
  isInheritedFromCourse: boolean;
  isBatchMapped: boolean;
  canRemoveBatchMapping: boolean;
  curriculum: CurriculumDetail;
};

export type BatchCurriculumWorkspace = {
  batchId: string;
  batchCode: string;
  batchName: string;
  programId: string | null;
  programName: string | null;
  courseId: string | null;
  courseCode: string | null;
  courseName: string | null;
  assignedCurricula: BatchAssignedCurriculumDetail[];
  availableCurricula: CurriculumSummary[];
};