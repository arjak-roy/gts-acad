import { AttendanceStatus } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { MarkAttendanceInput } from "@/lib/validation-schemas/attendance";
import { recomputeLearnerReadiness } from "@/services/readiness-service";

export async function markAttendanceService(input: MarkAttendanceInput) {
  if (!isDatabaseConfigured) {
    return {
      batchCode: input.batchCode,
      recordsUpdated: input.records.length,
      sessionDate: input.sessionDate.toISOString(),
    };
  }

  const batch = await prisma.batch.findUnique({
    where: { code: input.batchCode },
    include: {
      enrollments: {
        where: {
          learner: {
            learnerCode: { in: input.records.map((record) => record.learnerId) },
          },
        },
        include: {
          learner: true,
        },
      },
    },
  });

  if (!batch) {
    throw new Error("Batch not found.");
  }

  const enrollmentMap = new Map(batch.enrollments.map((enrollment) => [enrollment.learner.learnerCode, enrollment]));
  const missingLearners = input.records.filter((record) => !enrollmentMap.has(record.learnerId));
  if (missingLearners.length > 0) {
    throw new Error(`Learners missing from batch ${input.batchCode}: ${missingLearners.map((row) => row.learnerId).join(", ")}`);
  }

  await prisma.$transaction(async (transaction) => {
    for (const record of input.records) {
      const enrollment = enrollmentMap.get(record.learnerId);
      if (!enrollment) {
        continue;
      }

      await transaction.attendanceRecord.upsert({
        where: {
          enrollmentId_sessionDate: {
            enrollmentId: enrollment.id,
            sessionDate: input.sessionDate,
          },
        },
        update: {
          status: record.status as AttendanceStatus,
          notes: record.notes,
          markedById: input.markedByUserId,
        },
        create: {
          enrollmentId: enrollment.id,
          sessionDate: input.sessionDate,
          status: record.status as AttendanceStatus,
          notes: record.notes,
          markedById: input.markedByUserId,
        },
      });
    }
  });

  await Promise.all(batch.enrollments.map((enrollment) => recomputeLearnerReadiness(enrollment.learnerId)));

  return {
    batchCode: batch.code,
    recordsUpdated: input.records.length,
    sessionDate: input.sessionDate.toISOString(),
  };
}
