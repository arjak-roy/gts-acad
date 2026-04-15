/**
 * Prompt Framework — Compilation service
 *
 * Orchestrates the full prompt assembly pipeline:
 * base → overlay → runtime metadata → content-block contract injection.
 */

import type { PromptType } from "@/lib/language-lab/prompt-types";
import type { PersonaCapability } from "@/lib/language-lab/content-blocks";
import { normalizeCapabilities } from "@/lib/language-lab/content-blocks";
import { buildRuntimePrompt, resolveCompiledPromptValue } from "@/lib/language-lab/prompt-framework";
import { PROMPT_TYPE_SETTING_KEYS, LANGUAGE_LAB_DEFAULT_CONFIG } from "@/lib/language-lab/default-config";

/**
 * Build the complete system prompt for a given prompt type and persona.
 *
 * @param promptType - The AI interaction type (buddy, roleplay, pronunciation, speakingTest)
 * @param basePromptValue - The stored base prompt value (structured or raw)
 * @param persona - Optional persona/overlay configuration
 * @returns Fully assembled system prompt string ready for the AI model
 */
export function compileFullSystemPrompt(params: {
  promptType: PromptType;
  basePromptValue: string | null | undefined;
  persona?: {
    name: string;
    description?: string | null;
    language: string;
    languageCode: string;
    welcomeMessage?: string | null;
    systemPromptValue: string;
    capabilities: PersonaCapability[];
  } | null;
}): string {
  const settingKey = PROMPT_TYPE_SETTING_KEYS[params.promptType];
  const legacyFallback = getLegacyFallbackPrompt(params.promptType);

  return buildRuntimePrompt({
    promptType: params.promptType,
    basePromptValue: params.basePromptValue,
    baseFallbackValue: legacyFallback,
    persona: params.persona
      ? {
          name: params.persona.name,
          description: params.persona.description,
          language: params.persona.language,
          languageCode: params.persona.languageCode,
          welcomeMessage: params.persona.welcomeMessage,
          systemPromptValue: params.persona.systemPromptValue,
          capabilities: normalizeCapabilities(params.persona.capabilities),
        }
      : null,
  });
}

/**
 * Resolve a base prompt from its stored value or fall back to legacy defaults.
 */
export function resolveBasePrompt(
  promptType: PromptType,
  storedValue: string | null | undefined,
): string {
  return resolveCompiledPromptValue(storedValue, {
    fallbackValue: getLegacyFallbackPrompt(promptType),
  });
}

/**
 * Get the legacy hardcoded fallback prompt for a given type.
 * Used during migration period while existing prompts may still be raw strings.
 */
function getLegacyFallbackPrompt(promptType: PromptType): string {
  switch (promptType) {
    case "buddy":
      return LANGUAGE_LAB_DEFAULT_CONFIG.prompts.buddy;
    case "roleplay":
      return LANGUAGE_LAB_DEFAULT_CONFIG.prompts.roleplay;
    case "pronunciation":
      return LANGUAGE_LAB_DEFAULT_CONFIG.prompts.pronunciationAnalysis;
    case "speakingTest":
      return LANGUAGE_LAB_DEFAULT_CONFIG.prompts.speakingTest;
    default:
      return "";
  }
}
