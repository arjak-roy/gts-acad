/**
 * Prompt Framework — V1 → V2 data migration helpers
 *
 * Used by the data migration script (scripts/migrate-prompts-v2.mjs)
 * and by runtime auto-migration during prompt reads.
 */

import { parsePromptDocument, encodePromptDocument, createDefaultPromptDocument } from "@/lib/language-lab/prompt-framework";
import type { PromptDocument } from "@/lib/language-lab/prompt-framework";
import type { PromptType, PromptScope } from "@/lib/language-lab/prompt-types";
import { legacyFlagsToCapabilities } from "@/lib/language-lab/content-blocks";
import type { PersonaCapability } from "@/lib/language-lab/content-blocks";

/**
 * Convert a stored prompt value (V1, V2, or raw) into a V2 encoded document.
 * - V2 documents are returned as-is.
 * - V1 documents are auto-migrated to V2 format.
 * - Raw strings are wrapped in a V2 document with the text in the first section.
 */
export function migratePromptToV2(params: {
  rawValue: string | null | undefined;
  promptType: PromptType;
  scope: PromptScope;
}): { encoded: string; document: PromptDocument; wasRaw: boolean } {
  const { rawValue, promptType, scope } = params;

  // Try parsing — handles both V1 and V2
  const parsed = parsePromptDocument(rawValue);
  if (parsed) {
    return {
      encoded: encodePromptDocument(parsed),
      document: parsed,
      wasRaw: false,
    };
  }

  // Raw string — put it in the first section of a default doc
  const normalized = typeof rawValue === "string" ? rawValue.replace(/\r\n/g, "\n").trim() : "";
  const defaultDoc = createDefaultPromptDocument(promptType, scope);

  if (normalized) {
    const firstSectionId = Object.keys(defaultDoc.sections)[0];
    if (firstSectionId) {
      defaultDoc.sections[firstSectionId] = normalized;
    }
  }

  return {
    encoded: encodePromptDocument(defaultDoc),
    document: defaultDoc,
    wasRaw: true,
  };
}

/**
 * Convert legacy boolean capability flags to a capabilities array.
 */
export function migrateLegacyCapabilities(persona: {
  supportsTables?: boolean;
  supportsEmailActions?: boolean;
  supportsSpeech?: boolean;
}): PersonaCapability[] {
  return legacyFlagsToCapabilities(persona);
}
