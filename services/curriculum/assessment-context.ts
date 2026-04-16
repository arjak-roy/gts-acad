import type { CurriculumProgressStatus } from "@prisma/client";

import type {
  BatchCurriculumWorkspace,
  CurriculumStageItemAvailabilityReason,
  CurriculumStageItemAvailabilityStatus,
} from "@/services/curriculum/types";

export type CandidateAssessmentDeadlineSource = "CURRICULUM_DUE" | "SCHEDULE" | "TIME_LIMIT" | "NONE";

export type CandidateCurriculumAssessmentContext = {
  assessmentPoolId: string;
  curriculumId: string;
  curriculumTitle: string;
  mappingId: string;
  moduleId: string;
  moduleTitle: string;
  stageId: string;
  stageTitle: string;
  stageItemId: string;
  referenceCode: string | null;
  itemTitle: string;
  itemDescription: string | null;
  isRequired: boolean;
  availabilityStatus: CurriculumStageItemAvailabilityStatus;
  availabilityReason: CurriculumStageItemAvailabilityReason;
  unlockAt: Date | null;
  dueAt: Date | null;
  progressStatus: CurriculumProgressStatus;
  progressPercent: number;
  startedAt: Date | null;
  completedAt: Date | null;
};

export type ResolvedCandidateAssessmentWindow = {
  scheduledAt: Date | null;
  opensAt: Date | null;
  closesAt: Date | null;
  hardClosesAt: Date | null;
  deadlineSource: CandidateAssessmentDeadlineSource;
};

function toTimestamp(value: Date | null | undefined) {
  return value ? value.getTime() : Number.NaN;
}

function resolveMaxDate(values: Array<Date | null | undefined>) {
  const validValues = values.filter((value): value is Date => Boolean(value));

  if (validValues.length === 0) {
    return null;
  }

  return new Date(Math.max(...validValues.map((value) => value.getTime())));
}

function resolveMinDate(values: Array<Date | null | undefined>) {
  const validValues = values.filter((value): value is Date => Boolean(value));

  if (validValues.length === 0) {
    return null;
  }

  return new Date(Math.min(...validValues.map((value) => value.getTime())));
}

function shouldPreferCandidateContext(
  existingContext: CandidateCurriculumAssessmentContext,
  nextContext: CandidateCurriculumAssessmentContext,
) {
  const availabilityRank: Record<CandidateCurriculumAssessmentContext["availabilityStatus"], number> = {
    AVAILABLE: 2,
    SCHEDULED: 1,
    LOCKED: 0,
  };

  const existingRank = availabilityRank[existingContext.availabilityStatus];
  const nextRank = availabilityRank[nextContext.availabilityStatus];

  if (existingRank !== nextRank) {
    return nextRank > existingRank;
  }

  if (existingContext.dueAt && nextContext.dueAt) {
    return nextContext.dueAt.getTime() < existingContext.dueAt.getTime();
  }

  if (!existingContext.dueAt && nextContext.dueAt) {
    return true;
  }

  return toTimestamp(nextContext.unlockAt) < toTimestamp(existingContext.unlockAt);
}

export function buildCandidateCurriculumAssessmentContextMap(workspace: BatchCurriculumWorkspace) {
  const assessmentContextByPoolId = new Map<string, CandidateCurriculumAssessmentContext>();

  for (const assignment of workspace.assignedCurricula) {
    for (const moduleRecord of assignment.curriculum.modules) {
      for (const stage of moduleRecord.stages) {
        for (const item of stage.items) {
          if (!item.assessmentPoolId) {
            continue;
          }

          const nextContext: CandidateCurriculumAssessmentContext = {
            assessmentPoolId: item.assessmentPoolId,
            curriculumId: assignment.curriculum.id,
            curriculumTitle: assignment.curriculum.title,
            mappingId: assignment.mappingId,
            moduleId: moduleRecord.id,
            moduleTitle: moduleRecord.title,
            stageId: stage.id,
            stageTitle: stage.title,
            stageItemId: item.id,
            referenceCode: item.referenceCode,
            itemTitle: item.referenceTitle,
            itemDescription: item.referenceDescription,
            isRequired: item.isRequired,
            availabilityStatus: item.availabilityStatus,
            availabilityReason: item.availabilityReason,
            unlockAt: item.release.resolvedUnlockAt,
            dueAt: item.release.resolvedDueAt,
            progressStatus: item.progressStatus,
            progressPercent: item.progressPercent,
            startedAt: item.startedAt,
            completedAt: item.completedAt,
          };
          const existingContext = assessmentContextByPoolId.get(item.assessmentPoolId);

          if (!existingContext || shouldPreferCandidateContext(existingContext, nextContext)) {
            assessmentContextByPoolId.set(item.assessmentPoolId, nextContext);
          }
        }
      }
    }
  }

  return assessmentContextByPoolId;
}

export function resolveCandidateAssessmentWindow(options: {
  mappedOpensAt: Date | null | undefined;
  linkedOpensAt: Date | null | undefined;
  linkedClosesAt: Date | null | undefined;
  curriculumUnlockAt: Date | null | undefined;
  curriculumDueAt: Date | null | undefined;
}): ResolvedCandidateAssessmentWindow {
  const scheduledAt = options.linkedOpensAt ?? options.mappedOpensAt ?? null;
  const opensAt = resolveMaxDate([scheduledAt, options.curriculumUnlockAt]);
  const hardClosesAt = options.linkedClosesAt ?? null;
  const closesAt = resolveMinDate([options.curriculumDueAt, hardClosesAt]);

  if (closesAt && options.curriculumDueAt && closesAt.getTime() === options.curriculumDueAt.getTime()) {
    return {
      scheduledAt,
      opensAt,
      closesAt,
      hardClosesAt,
      deadlineSource: "CURRICULUM_DUE",
    };
  }

  if (closesAt && hardClosesAt && closesAt.getTime() === hardClosesAt.getTime()) {
    return {
      scheduledAt,
      opensAt,
      closesAt,
      hardClosesAt,
      deadlineSource: "SCHEDULE",
    };
  }

  return {
    scheduledAt,
    opensAt,
    closesAt,
    hardClosesAt,
    deadlineSource: closesAt ? "SCHEDULE" : "NONE",
  };
}