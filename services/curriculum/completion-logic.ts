import type { CurriculumCompletionRule, CurriculumProgressStatus } from "@prisma/client";

import type {
  CurriculumDetail,
  CurriculumModuleSummary,
  CurriculumStageSummary,
  CurriculumStageItemDetail,
} from "@/services/curriculum/types";

export type CurriculumItemProgressLookup = Map<string, {
  status: CurriculumProgressStatus | string;
  progressPercent: number;
}>;

export function evaluateStageCompletion(
  stage: CurriculumStageSummary,
  progressMap: CurriculumItemProgressLookup,
): boolean {
  const items = stage.items;
  if (items.length === 0) return true;

  const completedItems = items.filter(
    (item) => progressMap.get(item.id)?.status === "COMPLETED",
  );
  const requiredItems = items.filter((item) => item.isRequired);
  const completedRequiredItems = requiredItems.filter(
    (item) => progressMap.get(item.id)?.status === "COMPLETED",
  );

  return applyCompletionRule(
    stage.completionRule,
    stage.completionThreshold,
    items,
    completedItems,
    requiredItems,
    completedRequiredItems,
  );
}

export function evaluateModuleCompletion(
  module: CurriculumModuleSummary,
  progressMap: CurriculumItemProgressLookup,
): boolean {
  const stages = module.stages;
  if (stages.length === 0) return true;

  for (const stage of stages) {
    if (!evaluateStageCompletion(stage, progressMap)) return false;
  }

  const completedStages = stages.filter((stage) => evaluateStageCompletion(stage, progressMap));

  return applyCompletionRuleForStages(
    module.completionRule,
    module.completionThreshold,
    stages.length,
    completedStages.length,
  );
}

export function evaluateCurriculumCompletion(
  curriculum: CurriculumDetail,
  progressMap: CurriculumItemProgressLookup,
): boolean {
  const modules = curriculum.modules;
  if (modules.length === 0) return false;

  for (const module of modules) {
    if (!evaluateModuleCompletion(module, progressMap)) return false;
  }

  return true;
}

function applyCompletionRule(
  rule: CurriculumCompletionRule,
  threshold: number | null,
  allItems: CurriculumStageItemDetail[],
  completedItems: CurriculumStageItemDetail[],
  requiredItems: CurriculumStageItemDetail[],
  completedRequiredItems: CurriculumStageItemDetail[],
): boolean {
  switch (rule) {
    case "ALL_REQUIRED":
      return requiredItems.length > 0
        ? completedRequiredItems.length >= requiredItems.length
        : completedItems.length >= allItems.length;

    case "ALL_ITEMS":
      return completedItems.length >= allItems.length;

    case "PERCENTAGE": {
      const percentage = threshold ?? 100;
      const total = allItems.length;
      if (total === 0) return true;
      return (completedItems.length / total) * 100 >= percentage;
    }

    case "MIN_ITEMS": {
      const minimum = threshold ?? allItems.length;
      return completedItems.length >= minimum;
    }

    default:
      return completedItems.length >= allItems.length;
  }
}

function applyCompletionRuleForStages(
  rule: CurriculumCompletionRule,
  threshold: number | null,
  totalCount: number,
  completedCount: number,
): boolean {
  switch (rule) {
    case "ALL_REQUIRED":
      throw new Error("ALL_REQUIRED rule is only applicable to item-level completion.");
    case "ALL_ITEMS":
      return completedCount >= totalCount;

    case "PERCENTAGE": {
      const percentage = threshold ?? 100;
      if (totalCount === 0) return true;
      return (completedCount / totalCount) * 100 >= percentage;
    }

    case "MIN_ITEMS": {
      const minimum = threshold ?? totalCount;
      return completedCount >= minimum;
    }

    default:
      return completedCount >= totalCount;
  }
}