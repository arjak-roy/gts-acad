import { NextRequest } from "next/server";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { getLanguageLabRuntimeSettings } from "@/services/settings";

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["GET", "OPTIONS"]);
}

export async function GET(request: NextRequest) {
  try {
    await requireCandidateSession(request);

    const settings = await getLanguageLabRuntimeSettings();

    const response = apiSuccess({
      configured: settings.geminiApiKey.length > 0,
      geminiApiKey: settings.geminiApiKey,
      prompts: {
        buddy: settings.buddySystemPrompt,
        roleplay: settings.roleplaySystemPrompt,
        pronunciationAnalysis: settings.pronunciationSystemPrompt,
        speakingTest: settings.speakingTestSystemPrompt,
      },
      models: {
        buddyConversation: settings.buddyConversationModelId,
        roleplay: settings.roleplayModelId,
        pronunciation: settings.pronunciationModelId,
      },
    });

    return withCors(request, response, ["GET", "OPTIONS"]);
  } catch (error) {
    return withCors(request, apiError(error), ["GET", "OPTIONS"]);
  }
}