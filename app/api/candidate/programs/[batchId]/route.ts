import type { NextRequest } from "next/server";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { prisma } from "@/lib/prisma-client";
import { batchIdSchema } from "@/lib/validation-schemas/batches";
import { listBatchAssessmentsService, listBatchContentService } from "@/services/batch-content-service";
import { resolveBuddyPersonaForBatchService } from "@/services/buddy-personas-service";
import {
  buildCandidateCurriculumAssessmentContextMap,
  type CandidateCurriculumAssessmentContext,
  getCandidateCurriculaForBatchService,
  resolveCandidateAssessmentWindow,
  selectRelevantLinkedAssessmentEvent,
} from "@/services/curriculum-service";
import { getCandidateProfileByUserIdService } from "@/services/learners-service";
import { listScheduleEventsService } from "@/services/schedule-service";

type CandidateProgramLatestAttemptRecord = {
  assessmentPoolId: string;
  assessmentId: string;
  status: "DRAFT" | "PENDING_REVIEW" | "IN_REVIEW" | "GRADED";
  startedAt: Date;
  lastSavedAt: Date;
  deadlineAt: Date | null;
  autoSubmittedAt: Date | null;
  submittedAt: Date;
  gradedAt: Date | null;
  marksObtained: number | null;
  totalMarks: number;
  percentage: number | null;
  passed: boolean | null;
  requiresManualReview: boolean;
};

type RouteContext = {
  params: {
    batchId: string;
  };
};

function selectLinkedAssessmentEvent(
  schedule: Awaited<ReturnType<typeof listScheduleEventsService>>["items"],
  assessmentPoolId: string,
) {
  const relevantEvent = selectRelevantLinkedAssessmentEvent(
    schedule
      .filter((event) => event.linkedAssessmentPoolId === assessmentPoolId && event.status !== "CANCELLED")
      .map((event) => ({
        event,
        startsAt: new Date(event.startsAt),
        endsAt: event.endsAt ? new Date(event.endsAt) : null,
      })),
  );

  return relevantEvent?.event ?? null;
}

function serializeCurriculumAssessmentContext(context: CandidateCurriculumAssessmentContext) {
  return {
    assessmentPoolId: context.assessmentPoolId,
    curriculumId: context.curriculumId,
    curriculumTitle: context.curriculumTitle,
    mappingId: context.mappingId,
    moduleId: context.moduleId,
    moduleTitle: context.moduleTitle,
    stageId: context.stageId,
    stageTitle: context.stageTitle,
    stageItemId: context.stageItemId,
    referenceCode: context.referenceCode,
    itemTitle: context.itemTitle,
    itemDescription: context.itemDescription,
    isRequired: context.isRequired,
    availabilityStatus: context.availabilityStatus,
    availabilityReason: context.availabilityReason,
    unlockAt: context.unlockAt,
    dueAt: context.dueAt,
    progressStatus: context.progressStatus,
    progressPercent: context.progressPercent,
    startedAt: context.startedAt,
    completedAt: context.completedAt,
  };
}

function serializeLatestAttempt(record: CandidateProgramLatestAttemptRecord) {
  return {
    assessmentId: record.assessmentId,
    status: record.status,
    percentage: record.percentage,
    passed: record.passed,
    startedAt: record.startedAt,
    lastSavedAt: record.lastSavedAt,
    deadlineAt: record.deadlineAt,
    autoSubmittedAt: record.autoSubmittedAt,
    submittedAt: record.submittedAt,
    gradedAt: record.gradedAt,
    marksObtained: record.marksObtained,
    totalMarks: record.totalMarks,
    requiresManualReview: record.requiresManualReview,
  };
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["GET", "OPTIONS"]);
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireCandidateSession(request);
    const { batchId } = batchIdSchema.parse(params);
    const profile = await getCandidateProfileByUserIdService(session.userId);

    if (!profile) {
      throw new Error("Candidate profile not found.");
    }

    const enrollment = profile.activeEnrollments.find((item) => item.batchId === batchId);

    if (!enrollment) {
      throw new Error("Program not found.");
    }

    const [curriculumWorkspace, assessments, resources, scheduleResponse, buddyPersona] = await Promise.all([
      getCandidateCurriculaForBatchService({ batchId, learnerId: profile.id }),
      listBatchAssessmentsService(batchId, { publishedOnly: true }),
      listBatchContentService(batchId, { publishedOnly: true, includeAssignedResources: true }),
      listScheduleEventsService({ batchId, page: 1, pageSize: 100 }),
      resolveBuddyPersonaForBatchService(batchId),
    ]);

    const curriculum = {
      batchId: curriculumWorkspace.batchId,
      batchCode: curriculumWorkspace.batchCode,
      batchName: curriculumWorkspace.batchName,
      programId: curriculumWorkspace.programId,
      programName: curriculumWorkspace.programName,
      courseId: curriculumWorkspace.courseId,
      courseCode: curriculumWorkspace.courseCode,
      courseName: curriculumWorkspace.courseName,
      assignedCurricula: curriculumWorkspace.assignedCurricula,
    };
    const curriculumAssessmentContextByPoolId = buildCandidateCurriculumAssessmentContextMap(curriculumWorkspace);
    const assessmentPoolIds = Array.from(new Set(assessments.map((assessment) => assessment.assessmentPoolId)));
    const latestAttemptByPoolId = new Map<string, ReturnType<typeof serializeLatestAttempt>>();

    if (assessmentPoolIds.length > 0) {
      const latestAttempts = await prisma.assessmentAttempt.findMany({
        where: {
          learnerId: profile.id,
          batchId,
          assessmentPoolId: {
            in: assessmentPoolIds,
          },
        },
        orderBy: [{ assessmentPoolId: "asc" }, { startedAt: "desc" }, { lastSavedAt: "desc" }],
        select: {
          assessmentPoolId: true,
          assessmentId: true,
          status: true,
          startedAt: true,
          lastSavedAt: true,
          deadlineAt: true,
          autoSubmittedAt: true,
          submittedAt: true,
          gradedAt: true,
          marksObtained: true,
          totalMarks: true,
          percentage: true,
          passed: true,
          requiresManualReview: true,
        },
      });

      for (const attempt of latestAttempts) {
        if (!latestAttemptByPoolId.has(attempt.assessmentPoolId)) {
          latestAttemptByPoolId.set(attempt.assessmentPoolId, serializeLatestAttempt(attempt));
        }
      }
    }

    const candidateAssessments = assessments.map((assessment) => {
      const linkedEvent = selectLinkedAssessmentEvent(scheduleResponse.items, assessment.assessmentPoolId);
      const curriculumContext = curriculumAssessmentContextByPoolId.get(assessment.assessmentPoolId) ?? null;
      const resolvedWindow = resolveCandidateAssessmentWindow({
        mappedOpensAt: assessment.scheduledAt,
        linkedOpensAt: linkedEvent ? new Date(linkedEvent.startsAt) : null,
        linkedClosesAt: linkedEvent?.endsAt ? new Date(linkedEvent.endsAt) : null,
        curriculumUnlockAt: curriculumContext?.unlockAt,
        curriculumDueAt: curriculumContext?.dueAt,
      });

      return {
        ...assessment,
        scheduledAt: resolvedWindow.scheduledAt,
        opensAt: resolvedWindow.opensAt,
        closesAt: resolvedWindow.closesAt,
        hardClosesAt: resolvedWindow.hardClosesAt,
        deadlineSource: resolvedWindow.deadlineSource,
        curriculumContext: curriculumContext ? serializeCurriculumAssessmentContext(curriculumContext) : null,
        latestAttempt: latestAttemptByPoolId.get(assessment.assessmentPoolId) ?? null,
      };
    });

    const response = apiSuccess({
      enrollment,
      curriculum,
      buddyPersona,
      assessments: candidateAssessments,
      resources,
      schedule: scheduleResponse.items,
    });

    return withCors(request, response, ["GET", "OPTIONS"]);
  } catch (error) {
    return withCors(request, apiError(error), ["GET", "OPTIONS"]);
  }
}