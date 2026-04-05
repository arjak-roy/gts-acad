import { PlacementStatus, SyncStatus } from "@prisma/client";

import { sleep } from "@/lib/utils";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { SyncReadinessStatusInput } from "@/lib/validation-schemas/readiness";
import { ReadinessSyncResult } from "@/types";

function resolvePlacementStatus(score: number, threshold: number) {
  if (score >= threshold) {
    return PlacementStatus.PLACEMENT_READY;
  }

  if (score >= threshold - 10) {
    return PlacementStatus.IN_REVIEW;
  }

  return PlacementStatus.NOT_READY;
}

export async function recomputeLearnerReadiness(learnerId: string) {
  if (!isDatabaseConfigured) {
    throw new Error("Readiness recomputation requires a configured database.");
  }

  const learner = await prisma.learner.findUnique({
    where: { id: learnerId },
    include: {
      assessmentScores: true,
      enrollments: {
        include: {
          attendanceRecords: true,
        },
      },
    },
  });

  if (!learner) {
    throw new Error("Learner not found");
  }

  const rule =
    (await prisma.readinessEngineRule.findFirst({
      where: { isDefault: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.readinessEngineRule.create({
      data: {
        name: "default",
        isDefault: true,
      },
    }));

  const attendanceRecords = learner.enrollments.flatMap((enrollment) => enrollment.attendanceRecords);
  const attendanceAverage = attendanceRecords.length
    ? attendanceRecords.reduce((accumulator, record) => {
        if (record.status === "PRESENT") return accumulator + 100;
        if (record.status === "LATE") return accumulator + 60;
        if (record.status === "EXCUSED") return accumulator + 80;
        return accumulator;
      }, 0) / attendanceRecords.length
    : 0;

  const assessmentAverage = learner.assessmentScores.length
    ? learner.assessmentScores.reduce((accumulator, item) => accumulator + item.score, 0) / learner.assessmentScores.length
    : 0;

  const readinessScore = Math.round(
    (attendanceAverage * rule.attendanceWeight + assessmentAverage * rule.assessmentWeight + learner.softSkillsScore * rule.softSkillsWeight) / 100,
  );

  const status = resolvePlacementStatus(readinessScore, rule.placementThreshold);

  const snapshot = await prisma.$transaction(async (transaction) => {
    await transaction.learner.update({
      where: { id: learner.id },
      data: {
        readinessPercentage: readinessScore,
        placementStatus: status,
        latestAttendancePercentage: attendanceAverage,
        latestAssessmentAverage: assessmentAverage,
      },
    });

    return transaction.readinessSnapshot.create({
      data: {
        learnerId: learner.id,
        ruleId: rule.id,
        percentage: readinessScore,
        status,
        syncStatus: SyncStatus.NOT_SYNCED,
      },
    });
  });

  return { learner, snapshot, readinessScore, status };
}

export async function syncReadinessStatusService(input: SyncReadinessStatusInput): Promise<ReadinessSyncResult> {
  if (!isDatabaseConfigured) {
    await sleep(500);

    return {
      learnerId: input.learnerCode,
      learnerCode: input.learnerCode,
      syncStatus: "SYNCED",
      destination: input.destination,
      message: "Demo sync completed without a configured database connection.",
    };
  }

  const learner = await prisma.learner.findUnique({
    where: { learnerCode: input.learnerCode },
    include: {
      readinessSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!learner) {
    throw new Error("Learner not found for readiness sync.");
  }

  const readinessState = await recomputeLearnerReadiness(learner.id);
  if (readinessState.status !== PlacementStatus.PLACEMENT_READY) {
    throw new Error("Only placement-ready learners can be synced.");
  }

  const payload = {
    learnerCode: learner.learnerCode,
    name: learner.fullName,
    readinessPercentage: readinessState.readinessScore,
    placementStatus: readinessState.status,
    syncedAt: new Date().toISOString(),
  };

  await sleep(650);

  const response = {
    accepted: true,
    destination: input.destination,
    externalReference: `RW-${learner.learnerCode}`,
  };

  await prisma.$transaction(async (transaction) => {
    await transaction.learner.update({
      where: { id: learner.id },
      data: {
        recruiterSyncStatus: SyncStatus.SYNCED,
      },
    });

    await transaction.recruiterSyncLog.create({
      data: {
        learnerId: learner.id,
        triggeredById: input.triggeredByUserId,
        destination: input.destination,
        status: SyncStatus.SYNCED,
        payload,
        responseBody: response,
        message: "Placement-ready learner synced to recruiter workspace.",
      },
    });

    await transaction.readinessSnapshot.update({
      where: { id: readinessState.snapshot.id },
      data: {
        syncStatus: SyncStatus.SYNCED,
        syncedAt: new Date(),
        notes: `Delivered to ${input.destination}`,
      },
    });
  });

  return {
    learnerId: learner.id,
    learnerCode: learner.learnerCode,
    syncStatus: SyncStatus.SYNCED,
    destination: input.destination,
    message: "Learner synced to Recruiter Workspace successfully.",
  };
}
