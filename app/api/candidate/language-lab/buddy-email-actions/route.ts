import { NextRequest } from "next/server";

import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { requestBuddyEmailActionSchema } from "@/lib/validation-schemas/language-lab";
import { resolveBuddyPersonaForBatchService } from "@/services/buddy-personas-service";
import { sendCandidateBuddyEmailActionNotification } from "@/services/candidate-notifications";
import { getCandidateProfileByUserIdService } from "@/services/learners-service";

const METHODS = ["POST", "OPTIONS"];

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, METHODS);
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireCandidateSession(request);
    const body = await request.json();
    const input = requestBuddyEmailActionSchema.parse(body);

    const profile = await getCandidateProfileByUserIdService(session.userId);

    if (!profile) {
      throw new Error("Candidate profile not found.");
    }

    const enrollment = profile.activeEnrollments.find((item) => item.batchId === input.batchId);

    if (!enrollment) {
      throw new Error("Program not found.");
    }

    const buddyPersona = await resolveBuddyPersonaForBatchService(input.batchId);

    if (!buddyPersona) {
      throw new Error("Buddy persona not found for this batch.");
    }

    if (!buddyPersona.supportsEmailActions) {
      throw new Error("Buddy email actions are not enabled for this batch.");
    }

    const result = await sendCandidateBuddyEmailActionNotification({
      learnerId: profile.id,
      batchId: input.batchId,
      buddyPersonaName: buddyPersona.name,
      senderName: profile.fullName,
      senderLearnerCode: profile.learnerCode,
      senderEmail: profile.email,
      target: input.target,
      emailSubject: input.subject,
      candidateMessage: input.message,
      actorUserId: session.userId,
    });

    const response = apiSuccess({
      sent: true,
      target: result.target,
      targetLabel: result.targetLabel,
      recipientName: result.recipientName,
    });

    return withCors(request, response, METHODS);
  } catch (error) {
    return withCors(request, apiError(error), METHODS);
  }
}