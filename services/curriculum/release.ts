import type { CurriculumItemReleaseType, CurriculumProgressStatus } from "@prisma/client";

import type {
  CurriculumStageItemAvailabilityReason,
  CurriculumStageItemAvailabilityStatus,
  CurriculumStageItemReleaseDetail,
} from "@/services/curriculum/types";

type CurriculumStageItemReleaseInput = {
  releaseType: CurriculumItemReleaseType;
  releaseAt: Date | null;
  releaseOffsetDays: number | null;
  prerequisiteStageItemId: string | null;
  prerequisiteTitle: string | null;
  minimumScorePercent: number | null;
  estimatedDurationMinutes: number | null;
  dueAt: Date | null;
  dueOffsetDays: number | null;
};

type CurriculumStageItemAvailabilityInput = {
  batchStartDate: Date;
  now?: Date;
  progressStatus: CurriculumProgressStatus;
  manualReleaseAt: Date | null;
  release: CurriculumStageItemReleaseInput | null;
  defaultPrerequisiteStageItemId: string | null;
  defaultPrerequisiteTitle: string | null;
  prerequisiteProgressStatus: CurriculumProgressStatus | null;
  prerequisiteScorePercent: number | null;
};

type CurriculumStageItemAvailabilitySnapshot = {
  availabilityStatus: CurriculumStageItemAvailabilityStatus;
  availabilityReason: CurriculumStageItemAvailabilityReason;
  release: CurriculumStageItemReleaseDetail;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function addDays(value: Date, dayCount: number) {
  return new Date(value.getTime() + dayCount * 24 * 60 * 60 * 1000);
}

function formatDateTime(value: Date) {
  return dateTimeFormatter.format(value);
}

function buildAvailabilityReason(input: Omit<CurriculumStageItemAvailabilityReason, "message"> & { message?: string }) {
  return {
    type: input.type,
    message: input.message ?? "Available now.",
    unlocksAt: input.unlocksAt,
    prerequisiteStageItemId: input.prerequisiteStageItemId,
    prerequisiteStageId: input.prerequisiteStageId ?? null,
    prerequisiteModuleId: input.prerequisiteModuleId ?? null,
    prerequisiteTitle: input.prerequisiteTitle,
    requiredScorePercent: input.requiredScorePercent,
    batchOffsetDays: input.batchOffsetDays,
  } satisfies CurriculumStageItemAvailabilityReason;
}

function resolveReleaseDetail(options: {
  batchStartDate: Date;
  manualReleaseAt: Date | null;
  release: CurriculumStageItemReleaseInput | null;
  defaultPrerequisiteStageItemId: string | null;
  defaultPrerequisiteTitle: string | null;
}) {
  const releaseType = options.release?.releaseType ?? "IMMEDIATE";
  const explicitPrerequisiteStageItemId = options.release?.prerequisiteStageItemId ?? null;
  const prerequisiteStageItemId = explicitPrerequisiteStageItemId ?? options.defaultPrerequisiteStageItemId;
  const prerequisiteTitle = options.release?.prerequisiteTitle ?? options.defaultPrerequisiteTitle;
  const resolvedUnlockAt = releaseType === "ABSOLUTE_DATE"
    ? options.release?.releaseAt ?? null
    : releaseType === "BATCH_RELATIVE"
      ? addDays(options.batchStartDate, options.release?.releaseOffsetDays ?? 0)
      : releaseType === "MANUAL"
        ? options.manualReleaseAt
        : null;
  const resolvedDueAt = options.release?.dueAt
    ?? (typeof options.release?.dueOffsetDays === "number" ? addDays(options.batchStartDate, options.release.dueOffsetDays) : null);

  return {
    releaseType,
    releaseAt: options.release?.releaseAt ?? null,
    releaseOffsetDays: options.release?.releaseOffsetDays ?? null,
    prerequisiteStageItemId,
    prerequisiteTitle,
    minimumScorePercent: options.release?.minimumScorePercent ?? null,
    estimatedDurationMinutes: options.release?.estimatedDurationMinutes ?? null,
    dueAt: options.release?.dueAt ?? null,
    dueOffsetDays: options.release?.dueOffsetDays ?? null,
    resolvedUnlockAt,
    resolvedDueAt,
  } satisfies CurriculumStageItemReleaseDetail;
}

export function resolveCurriculumStageItemAvailability(
  input: CurriculumStageItemAvailabilityInput,
): CurriculumStageItemAvailabilitySnapshot {
  const release = resolveReleaseDetail({
    batchStartDate: input.batchStartDate,
    manualReleaseAt: input.manualReleaseAt,
    release: input.release,
    defaultPrerequisiteStageItemId: input.defaultPrerequisiteStageItemId,
    defaultPrerequisiteTitle: input.defaultPrerequisiteTitle,
  });
  const now = input.now ?? new Date();

  if (input.progressStatus !== "NOT_STARTED") {
    return {
      availabilityStatus: "AVAILABLE",
      availabilityReason: buildAvailabilityReason({
        type: "AVAILABLE_NOW",
        message: "Available now.",
        unlocksAt: release.resolvedUnlockAt,
        prerequisiteStageItemId: release.prerequisiteStageItemId,
        prerequisiteStageId: null,
        prerequisiteModuleId: null,
        prerequisiteTitle: release.prerequisiteTitle,
        requiredScorePercent: release.minimumScorePercent,
        batchOffsetDays: release.releaseOffsetDays,
      }),
      release,
    };
  }

  if (release.releaseType === "ABSOLUTE_DATE" && release.resolvedUnlockAt) {
    if (release.resolvedUnlockAt.getTime() > now.getTime()) {
      return {
        availabilityStatus: "SCHEDULED",
        availabilityReason: buildAvailabilityReason({
          type: "UNLOCKS_AT_DATE",
          message: `Unlocks on ${formatDateTime(release.resolvedUnlockAt)}.`,
          unlocksAt: release.resolvedUnlockAt,
          prerequisiteStageItemId: release.prerequisiteStageItemId,
          prerequisiteStageId: null,
          prerequisiteModuleId: null,
          prerequisiteTitle: release.prerequisiteTitle,
          requiredScorePercent: release.minimumScorePercent,
          batchOffsetDays: release.releaseOffsetDays,
        }),
        release,
      };
    }
  }

  if (release.releaseType === "BATCH_RELATIVE" && release.resolvedUnlockAt) {
    if (release.resolvedUnlockAt.getTime() > now.getTime()) {
      const dayCount = release.releaseOffsetDays ?? 0;
      return {
        availabilityStatus: "SCHEDULED",
        availabilityReason: buildAvailabilityReason({
          type: "UNLOCKS_AFTER_BATCH_OFFSET",
          message: `Unlocks ${dayCount === 1 ? "1 day" : `${dayCount} days`} after batch start on ${formatDateTime(release.resolvedUnlockAt)}.`,
          unlocksAt: release.resolvedUnlockAt,
          prerequisiteStageItemId: release.prerequisiteStageItemId,
          prerequisiteStageId: null,
          prerequisiteModuleId: null,
          prerequisiteTitle: release.prerequisiteTitle,
          requiredScorePercent: release.minimumScorePercent,
          batchOffsetDays: release.releaseOffsetDays,
        }),
        release,
      };
    }
  }

  if (release.releaseType === "PREVIOUS_ITEM_COMPLETION" && release.prerequisiteStageItemId) {
    if (input.prerequisiteProgressStatus !== "COMPLETED") {
      const prerequisiteTitle = release.prerequisiteTitle ?? "the previous lesson";
      return {
        availabilityStatus: "LOCKED",
        availabilityReason: buildAvailabilityReason({
          type: "WAITING_FOR_PREVIOUS_ITEM",
          message: `Complete ${JSON.stringify(prerequisiteTitle)} to unlock this item.`,
          unlocksAt: null,
          prerequisiteStageItemId: release.prerequisiteStageItemId,
          prerequisiteStageId: null,
          prerequisiteModuleId: null,
          prerequisiteTitle,
          requiredScorePercent: null,
          batchOffsetDays: null,
        }),
        release,
      };
    }
  }

  if (release.releaseType === "PREVIOUS_ITEM_SCORE" && release.prerequisiteStageItemId) {
    if (release.minimumScorePercent == null) {
      throw new Error(`PREVIOUS_ITEM_SCORE release is missing a required minimumScorePercent on item ${release.prerequisiteStageItemId}`);
    }
    const requiredScorePercent = release.minimumScorePercent;
    if ((input.prerequisiteScorePercent ?? -1) < requiredScorePercent) {
      const prerequisiteTitle = release.prerequisiteTitle ?? "the previous assessment";
      return {
        availabilityStatus: "LOCKED",
        availabilityReason: buildAvailabilityReason({
          type: "WAITING_FOR_PASSING_SCORE",
          message: `Score at least ${requiredScorePercent}% on ${JSON.stringify(prerequisiteTitle)} to unlock this item.`,
          unlocksAt: null,
          prerequisiteStageItemId: release.prerequisiteStageItemId,
          prerequisiteStageId: null,
          prerequisiteModuleId: null,
          prerequisiteTitle,
          requiredScorePercent,
          batchOffsetDays: null,
        }),
        release,
      };
    }
  }

  if (release.releaseType === "MANUAL") {
    if (!input.manualReleaseAt) {
      return {
        availabilityStatus: "LOCKED",
        availabilityReason: buildAvailabilityReason({
          type: "MANUAL_RELEASE_REQUIRED",
          message: "Your academy team will release this item manually.",
          unlocksAt: null,
          prerequisiteStageItemId: null,
          prerequisiteStageId: null,
          prerequisiteModuleId: null,
          prerequisiteTitle: null,
          requiredScorePercent: null,
          batchOffsetDays: null,
        }),
        release,
      };
    }

    return {
      availabilityStatus: "AVAILABLE",
      availabilityReason: buildAvailabilityReason({
        type: "MANUALLY_RELEASED",
        message: `Released by your academy team on ${formatDateTime(input.manualReleaseAt)}.`,
        unlocksAt: input.manualReleaseAt,
        prerequisiteStageItemId: null,
        prerequisiteStageId: null,
        prerequisiteModuleId: null,
        prerequisiteTitle: null,
        requiredScorePercent: null,
        batchOffsetDays: null,
      }),
      release,
    };
  }

  return {
    availabilityStatus: "AVAILABLE",
    availabilityReason: buildAvailabilityReason({
      type: "AVAILABLE_NOW",
      message: "Available now.",
      unlocksAt: release.resolvedUnlockAt,
      prerequisiteStageItemId: release.prerequisiteStageItemId,
      prerequisiteStageId: null,
      prerequisiteModuleId: null,
      prerequisiteTitle: release.prerequisiteTitle,
      requiredScorePercent: release.minimumScorePercent,
      batchOffsetDays: release.releaseOffsetDays,
    }),
    release,
  };
}