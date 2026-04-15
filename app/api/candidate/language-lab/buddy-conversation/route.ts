import { NextRequest } from "next/server";

import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { requestBuddyConversationSchema } from "@/lib/validation-schemas/language-lab";
import { resolveBuddyPersonaForBatchService } from "@/services/buddy-personas-service";
import { requestBuddyConversationService } from "@/services/buddy-conversation-service";
import { getCandidateProfileByUserIdService } from "@/services/learners-service";
import { getLanguageLabRuntimeSettings } from "@/services/settings";

const METHODS = ["POST", "OPTIONS"];

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, METHODS);
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireCandidateSession(request);
    const body = await request.json();
    const input = requestBuddyConversationSchema.parse(body);

    const [profile, settings] = await Promise.all([
      getCandidateProfileByUserIdService(session.userId),
      getLanguageLabRuntimeSettings(),
    ]);

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

    const conversation = await requestBuddyConversationService({
      message: input.message,
      enrollment: {
        batchId: enrollment.batchId,
        batchCode: enrollment.batchCode,
        batchName: enrollment.batchName,
        programName: enrollment.programName,
        courseName: enrollment.courseName,
        campus: enrollment.campus ?? null,
      },
      persona: buddyPersona,
      settings: {
        geminiApiKey: settings.geminiApiKey,
        buddyConversationModelId: settings.buddyConversationModelId,
        buddySystemPrompt: settings.buddySystemPrompt,
      },
    });

    return withCors(request, apiSuccess(conversation), METHODS);
  } catch (error) {
    return withCors(request, apiError(error), METHODS);
  }
}