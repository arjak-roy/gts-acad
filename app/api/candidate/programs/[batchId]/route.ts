import type { NextRequest } from "next/server";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { batchIdSchema } from "@/lib/validation-schemas/batches";
import { listBatchAssessmentsService, listBatchContentService } from "@/services/batch-content-service";
import { resolveBuddyPersonaForBatchService } from "@/services/buddy-personas-service";
import { getCandidateCurriculaForBatchService } from "@/services/curriculum-service";
import { getCandidateProfileByUserIdService } from "@/services/learners-service";
import { listScheduleEventsService } from "@/services/schedule-service";

type RouteContext = {
  params: {
    batchId: string;
  };
};

function selectLinkedAssessmentEvent(
  schedule: Awaited<ReturnType<typeof listScheduleEventsService>>["items"],
  assessmentPoolId: string,
) {
  return (
    schedule
      .filter((event) => event.linkedAssessmentPoolId === assessmentPoolId && event.status !== "CANCELLED")
      .sort((left, right) => {
        const leftTime = new Date(left.startsAt).getTime();
        const rightTime = new Date(right.startsAt).getTime();

        return leftTime - rightTime;
      })[0] ?? null
  );
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

    const candidateAssessments = assessments.map((assessment) => {
      const linkedEvent = selectLinkedAssessmentEvent(scheduleResponse.items, assessment.assessmentPoolId);
      const opensAt = linkedEvent ? new Date(linkedEvent.startsAt) : assessment.scheduledAt;
      const closesAt = linkedEvent?.endsAt ? new Date(linkedEvent.endsAt) : null;

      return {
        ...assessment,
        scheduledAt: opensAt,
        opensAt,
        closesAt,
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