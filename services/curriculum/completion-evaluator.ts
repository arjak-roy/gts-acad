import "server-only";

import { getCandidateCurriculaForBatchService } from "@/services/curriculum/queries";
import { listCurriculumItemProgressForLearnerService } from "@/services/curriculum/progress";
import {
  evaluateCurriculumCompletion,
  type CurriculumItemProgressLookup as ItemProgressMap,
} from "@/services/curriculum/completion-logic";
import type {
  CurriculumDetail,
} from "@/services/curriculum/types";

// ── Types ────────────────────────────────────────────────────────────────────

export type CurriculumCompletionResult = {
  completed: boolean;
  curriculumId: string | null;
  curriculumTitle: string | null;
};

// ── High-level check: learner × batch ────────────────────────────────────────

export async function checkLearnerCurriculumCompletion(
  learnerId: string,
  batchId: string,
): Promise<CurriculumCompletionResult[]> {
  try {
    const workspace = await getCandidateCurriculaForBatchService({ batchId, learnerId });
    const results: CurriculumCompletionResult[] = [];

    for (const assignment of workspace.assignedCurricula) {
      const curriculum = assignment.curriculum;
      if (!curriculum || curriculum.modules.length === 0) continue;

      // Collect all stage item IDs
      const stageItemIds = curriculum.modules.flatMap((m) =>
        m.stages.flatMap((s) => s.items.map((item) => item.id)),
      );

      if (stageItemIds.length === 0) continue;

      // Load progress
      const progressRows = await listCurriculumItemProgressForLearnerService({
        learnerId,
        batchId,
        stageItemIds,
      });

      const progressMap: ItemProgressMap = new Map(
        progressRows.map((row) => [
          row.stageItemId,
          { status: row.status, progressPercent: row.progressPercent },
        ]),
      );

      if (evaluateCurriculumCompletion(curriculum, progressMap)) {
        results.push({
          completed: true,
          curriculumId: curriculum.id,
          curriculumTitle: curriculum.title,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("[completion-evaluator] Error checking learner curriculum completion:", error);
    return [];
  }
}

export {
  evaluateStageCompletion,
  evaluateModuleCompletion,
  evaluateCurriculumCompletion,
} from "@/services/curriculum/completion-logic";
