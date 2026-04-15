import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { listPromptVersions, getPromptVersion } from "@/services/language-lab/prompt-framework";
import type { PromptType } from "@/lib/language-lab/prompt-types";
import { PROMPT_TYPES } from "@/lib/language-lab/prompt-types";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "lms.view");

    const params = request.nextUrl.searchParams;
    const personaId = params.get("personaId") || null;
    const settingKey = params.get("settingKey") || null;
    const promptType = params.get("promptType") as PromptType | null;
    const scope = params.get("scope") as "base" | "overlay" | null;
    const versionId = params.get("versionId");

    // Single version by ID
    if (versionId) {
      const version = await getPromptVersion(versionId);
      if (!version) {
        return apiError(new Error("Prompt version not found."));
      }
      return apiSuccess(version);
    }

    // List versions
    if (!promptType || !PROMPT_TYPES.includes(promptType)) {
      return apiError(new Error("promptType is required and must be one of: " + PROMPT_TYPES.join(", ")));
    }

    const versions = await listPromptVersions({
      personaId,
      settingKey,
      promptType,
      scope: scope ?? undefined,
    });

    return apiSuccess(versions);
  } catch (error) {
    return apiError(error);
  }
}
