/**
 * Prompt Framework v2
 *
 * Unified prompt engine for all Language Lab AI interaction types.
 * Handles storage, parsing, compilation, linting, inheritance,
 * and runtime prompt assembly with content-block contract injection.
 *
 * Replaces the legacy buddy-prompt-framework.ts.
 */

import type { PromptType, PromptScope, PromptSectionDefinition } from "./prompt-types";
import { getSectionDefinitions, getDefaultSectionValues, getPromptTypeEntry } from "./prompt-types";
import type { PersonaCapability, ContentBlockType } from "./content-blocks";
import { CAPABILITY_BLOCK_MAP, CAPABILITY_LABELS } from "./content-blocks";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PromptDocument = {
  version: 2;
  promptType: PromptType;
  scope: PromptScope;
  sections: Record<string, string>;
};

/** V1 document shape for backward compat parsing. */
type PromptDocumentV1 = {
  version: 1;
  scope: "base" | "persona";
  sections: Record<string, string>;
};

export type PromptLintIssueSeverity = "info" | "warning" | "error";

export type PromptLintIssue = {
  code: string;
  severity: PromptLintIssueSeverity;
  message: string;
};

export type RuntimePromptPersona = {
  name: string;
  description?: string | null;
  language: string;
  languageCode: string;
  welcomeMessage?: string | null;
  systemPromptValue: string;
  capabilities: PersonaCapability[];
};

// ---------------------------------------------------------------------------
// Storage format
// ---------------------------------------------------------------------------

const V2_PREFIX = "[[GTS_BUDDY_PROMPT_DOC_V2]]";
const V2_SUFFIX = "[[/GTS_BUDDY_PROMPT_DOC_V2]]";
const V1_PREFIX = "[[GTS_BUDDY_PROMPT_DOC_V1]]";
const V1_SUFFIX = "[[/GTS_BUDDY_PROMPT_DOC_V1]]";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeValue(value: string | null | undefined): string {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeSections(
  definitions: PromptSectionDefinition[],
  rawSections: Record<string, unknown>,
  defaults: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const def of definitions) {
    const raw = rawSections[def.id];
    const value = normalizeValue(typeof raw === "string" ? raw : defaults[def.id] ?? "");
    result[def.id] = value;
  }

  return result;
}

function buildSectionBlock(def: PromptSectionDefinition, value: string): string {
  const normalized = normalizeValue(value);
  if (!normalized) return "";
  return `${def.compileHeading}:\n${normalized}`;
}

// ---------------------------------------------------------------------------
// V1 → V2 migration
// ---------------------------------------------------------------------------

function v1ScopeToPromptScope(scope: "base" | "persona"): PromptScope {
  return scope === "persona" ? "overlay" : "base";
}

function migrateV1ToV2(v1: PromptDocumentV1): PromptDocument {
  return {
    version: 2,
    promptType: "buddy",
    scope: v1ScopeToPromptScope(v1.scope),
    sections: { ...v1.sections },
  };
}

// ---------------------------------------------------------------------------
// Encode / Decode
// ---------------------------------------------------------------------------

export function encodePromptDocument(doc: PromptDocument): string {
  return [V2_PREFIX, JSON.stringify(doc, null, 2), V2_SUFFIX].join("\n");
}

export function parsePromptDocument(rawValue: string | null | undefined): PromptDocument | null {
  const normalized = normalizeValue(rawValue);
  if (!normalized) return null;

  // Try V2 first
  if (normalized.startsWith(V2_PREFIX) && normalized.endsWith(V2_SUFFIX)) {
    const json = normalized.slice(V2_PREFIX.length, normalized.length - V2_SUFFIX.length).trim();
    if (!json) return null;

    try {
      const decoded: unknown = JSON.parse(json);
      if (!isRecord(decoded)) return null;

      const { version, promptType, scope, sections } = decoded;
      if (version !== 2) return null;
      if (typeof promptType !== "string" || typeof scope !== "string") return null;
      if (scope !== "base" && scope !== "overlay") return null;
      if (!isRecord(sections)) return null;

      const definitions = getSectionDefinitions(promptType as PromptType, scope);
      const defaults = getDefaultSectionValues(promptType as PromptType, scope);

      return {
        version: 2,
        promptType: promptType as PromptType,
        scope,
        sections: sanitizeSections(definitions, sections, defaults),
      };
    } catch {
      return null;
    }
  }

  // Try V1 (backward compat)
  if (normalized.startsWith(V1_PREFIX) && normalized.endsWith(V1_SUFFIX)) {
    const json = normalized.slice(V1_PREFIX.length, normalized.length - V1_SUFFIX.length).trim();
    if (!json) return null;

    try {
      const decoded: unknown = JSON.parse(json);
      if (!isRecord(decoded)) return null;

      const { version, scope, sections } = decoded;
      if (version !== 1) return null;
      if (scope !== "base" && scope !== "persona") return null;
      if (!isRecord(sections)) return null;

      const v1Doc: PromptDocumentV1 = { version: 1, scope, sections: sections as Record<string, string> };
      const v2Doc = migrateV1ToV2(v1Doc);

      const definitions = getSectionDefinitions(v2Doc.promptType, v2Doc.scope);
      const defaults = getDefaultSectionValues(v2Doc.promptType, v2Doc.scope);

      return {
        ...v2Doc,
        sections: sanitizeSections(definitions, v2Doc.sections, defaults),
      };
    } catch {
      return null;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDefaultPromptDocument(promptType: PromptType, scope: PromptScope): PromptDocument {
  return {
    version: 2,
    promptType,
    scope,
    sections: getDefaultSectionValues(promptType, scope),
  };
}

export function createDefaultPromptValue(promptType: PromptType, scope: PromptScope): string {
  return encodePromptDocument(createDefaultPromptDocument(promptType, scope));
}

// ---------------------------------------------------------------------------
// Compile
// ---------------------------------------------------------------------------

export function compilePromptDocument(doc: PromptDocument): string {
  const definitions = getSectionDefinitions(doc.promptType, doc.scope);

  return definitions
    .map((def) => buildSectionBlock(def, doc.sections[def.id] ?? ""))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function resolveCompiledPromptValue(
  rawValue: string | null | undefined,
  options?: { fallbackValue?: string | null },
): string {
  const doc = parsePromptDocument(rawValue);
  if (doc) return compilePromptDocument(doc);

  const normalized = normalizeValue(rawValue);
  if (normalized) return normalized;

  return normalizeValue(options?.fallbackValue);
}

export function countCompletedSections(doc: PromptDocument): number {
  const definitions = getSectionDefinitions(doc.promptType, doc.scope);
  return definitions.filter((def) => normalizeValue(doc.sections[def.id]).length > 0).length;
}

// ---------------------------------------------------------------------------
// Inheritance
// ---------------------------------------------------------------------------

/**
 * Fill empty overlay sections from the base document's sections.
 * Only fills sections whose IDs exist in both base and overlay definitions.
 */
export function resolveWithInheritance(
  baseSections: Record<string, string>,
  overlaySections: Record<string, string>,
): { merged: Record<string, string>; inherited: Set<string> } {
  const merged: Record<string, string> = {};
  const inherited = new Set<string>();

  for (const [key, value] of Object.entries(overlaySections)) {
    const normalized = normalizeValue(value);
    if (normalized) {
      merged[key] = normalized;
    } else if (key in baseSections && normalizeValue(baseSections[key])) {
      merged[key] = normalizeValue(baseSections[key]);
      inherited.add(key);
    } else {
      merged[key] = "";
    }
  }

  return { merged, inherited };
}

// ---------------------------------------------------------------------------
// Linting
// ---------------------------------------------------------------------------

const TABLE_PATTERN = /\btable\b|\btables\b|\bheaders\b|\brows\b/i;
const LIST_PATTERN = /\bunordered list\b|\bordered list\b|\bbullet list\b|\bnumbered list\b|\blist items\b/i;
const QUIZ_PATTERN = /\bquiz\b|\bmultiple choice\b|\boptions\b.*\bcorrect\b/i;
const VOCAB_PATTERN = /\bvocab.card\b|\bvocabulary card\b|\bword card\b/i;
const COMPARISON_PATTERN = /\bcomparison\b|\bcompare\b.*\bcolumns\b|\bside.by.side\b/i;
const GRAMMAR_PATTERN = /\bgrammar.pattern\b|\bgrammar.block\b|\bgrammar.rule\b/i;
const EMAIL_PATTERN = /emailaction|reminder email|draft\s+(an\s+)?email|send\s+(an\s+)?email|write\s+(an\s+)?email/i;
const SPEECH_PATTERN = /\bspeech\b|\bvoice\b|\btts\b|\bstt\b|speak out loud/i;
const RUNTIME_MECHANICS_PATTERN = /(return exactly one valid json object|required keys\s+"text"|response contract|required response shape|do not output markdown fences|outside the json object|main reply in\s+"text"|english translation of\s+"text"|emailaction|"blocks"\s+array)/i;

const CAPABILITY_PATTERNS: Partial<Record<PersonaCapability, RegExp>> = {
  tables: TABLE_PATTERN,
  lists: LIST_PATTERN,
  quizzes: QUIZ_PATTERN,
  "vocab-cards": VOCAB_PATTERN,
  comparisons: COMPARISON_PATTERN,
  "grammar-patterns": GRAMMAR_PATTERN,
  "email-actions": EMAIL_PATTERN,
  speech: SPEECH_PATTERN,
};

function collectRepeatedInstructionIssue(compiledPrompt: string): PromptLintIssue | null {
  const lines = compiledPrompt
    .split("\n")
    .map((line) => line.trim().toLowerCase().replace(/\s+/g, " "))
    .filter((line) => line.length >= 24);

  const seen = new Set<string>();
  const repeated = new Set<string>();

  for (const line of lines) {
    if (seen.has(line)) {
      repeated.add(line);
    } else {
      seen.add(line);
    }
  }

  if (repeated.size === 0) return null;

  return {
    code: "repeated-instructions",
    severity: "info",
    message: "Repeated instruction lines detected. Consolidate duplicates so the final prompt stays easier for the model to follow.",
  };
}

function collectBuddyRuntimeOwnershipIssue(params: {
  scope: PromptScope;
  promptType: PromptType;
  compiledPrompt: string;
}): PromptLintIssue | null {
  if (params.promptType !== "buddy" || !RUNTIME_MECHANICS_PATTERN.test(params.compiledPrompt)) {
    return null;
  }

  if (params.scope === "base") {
    return {
      code: "base-runtime-mechanics-duplication",
      severity: "warning",
      message: "Buddy base prompt appears to define runtime-owned mechanics such as JSON schema, response keys, or email action rules. Keep the base prompt focused on shared Buddy behavior and let runtime inject the contract.",
    };
  }

  if (params.scope === "overlay") {
    return {
      code: "overlay-runtime-mechanics-duplication",
      severity: "warning",
      message: "Buddy overlay appears to define runtime-owned mechanics such as JSON schema, response keys, or email action rules. Keep overlays focused on persona behavior and let runtime inject the contract.",
    };
  }

  return null;
}

export function lintPromptValue(params: {
  promptType: PromptType;
  scope: PromptScope;
  value: string | null | undefined;
  fallbackValue?: string | null;
  capabilities?: PersonaCapability[];
}): PromptLintIssue[] {
  const issues: PromptLintIssue[] = [];
  const doc = parsePromptDocument(params.value);
  const compiledPrompt = resolveCompiledPromptValue(params.value, { fallbackValue: params.fallbackValue });

  if (doc) {
    const definitions = getSectionDefinitions(doc.promptType, doc.scope);
    for (const def of definitions) {
      const value = normalizeValue(doc.sections[def.id]);
      if (def.required && !value) {
        issues.push({
          code: `missing-${def.id}`,
          severity: "warning",
          message: `${def.label} is empty. Structured prompts work better when every required section is deliberate instead of implicit.`,
        });
      }
    }
  } else if (normalizeValue(params.value)) {
    issues.push({
      code: "legacy-raw-mode",
      severity: "info",
      message: "This prompt is in raw mode. Convert it to the structured framework for full linting and section-level preview.",
    });
  }

  const entry = getPromptTypeEntry(params.promptType);
  const maxLength = params.scope === "base" ? entry.maxBaseLength : entry.maxOverlayLength;
  if (compiledPrompt.length > maxLength) {
    issues.push({
      code: "prompt-too-long",
      severity: "warning",
      message: `Compiled prompt is ${compiledPrompt.length} characters. Consider trimming it below about ${maxLength} characters so high-priority rules stay dense and readable.`,
    });
  }

  const repeatedIssue = collectRepeatedInstructionIssue(compiledPrompt);
  if (repeatedIssue) issues.push(repeatedIssue);

  const runtimeOwnershipIssue = collectBuddyRuntimeOwnershipIssue({
    scope: params.scope,
    promptType: params.promptType,
    compiledPrompt,
  });
  if (runtimeOwnershipIssue) {
    issues.push(runtimeOwnershipIssue);
  }

  // Capability conflict checks
  if (params.capabilities) {
    const enabledSet = new Set(params.capabilities);

    for (const [capability, pattern] of Object.entries(CAPABILITY_PATTERNS)) {
      if (pattern && !enabledSet.has(capability as PersonaCapability) && pattern.test(compiledPrompt)) {
        const label = CAPABILITY_LABELS[capability as PersonaCapability] ?? capability;
        issues.push({
          code: `${capability}-disabled-conflict`,
          severity: "warning",
          message: `This prompt mentions ${label.toLowerCase()} behavior while the "${capability}" capability is disabled. Remove the instruction or re-enable the capability.`,
        });
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Runtime prompt assembly
// ---------------------------------------------------------------------------

function buildContentBlockContract(capabilities: PersonaCapability[]): string {
  const enabledBlockTypes: ContentBlockType[] = [];

  for (const cap of capabilities) {
    const blockType = CAPABILITY_BLOCK_MAP[cap];
    if (blockType) enabledBlockTypes.push(blockType);
  }

  const lines: string[] = [
    "Runtime response contract:",
    '- Return exactly one valid JSON object with required keys "text" and "translation". No text outside the JSON object.',
    "- Omit optional keys completely when they are not needed.",
  ];

  // Block descriptions based on enabled capabilities
  if (enabledBlockTypes.length > 0) {
    lines.push(`- You may include an optional "blocks" array containing structured content elements when they make the answer clearer.`);
    lines.push(`- Each block must have a "type" field. Supported block types:`);

    if (enabledBlockTypes.includes("table")) {
      lines.push(`  - "table": { "type": "table", "headers": ["Col1", "Col2"], "rows": [["cell", "cell"]] }`);
    }

    if (enabledBlockTypes.includes("list")) {
      lines.push(`  - "list": { "type": "list", "style": "ordered"|"unordered", "items": ["item1", "item2"] }`);
    }

    if (enabledBlockTypes.includes("quiz")) {
      lines.push(`  - "quiz": { "type": "quiz", "question": "...", "options": [{"label": "A", "correct": true}, ...], "explanation": "..." }`);
    }

    if (enabledBlockTypes.includes("vocab-card")) {
      lines.push(`  - "vocab-card": { "type": "vocab-card", "word": "...", "translation": "...", "phonetic": "...", "example": "...", "gender": "..." }`);
    }

    if (enabledBlockTypes.includes("comparison")) {
      lines.push(`  - "comparison": { "type": "comparison", "columns": [{"label": "Formal", "items": [...]}, {"label": "Informal", "items": [...]}] }`);
    }

    if (enabledBlockTypes.includes("grammar")) {
      lines.push(`  - "grammar": { "type": "grammar", "pattern": "...", "explanation": "...", "examples": ["..."] }`);
    }

    lines.push(`- Only use blocks when structured presentation genuinely helps. Keep the "text" field as the complete reply — blocks are supplementary.`);
  }

  const hasEmailActions = capabilities.includes("email-actions");
  if (hasEmailActions) {
    lines.push(
      `- You may include an optional "emailAction" object only when the learner explicitly asks to draft, prepare, or send a reminder email to themselves.`,
      `- The "emailAction" object must contain exactly "subject" and "message".`,
      `- The app always sends the reminder to the authenticated learner's own inbox after confirmation.`,
      `- Keep "emailAction.message" ready to send, but never include personal contact details, learner codes, trainer names, hidden identity values, guessed private information, or placeholders.`,
      `- Never include "emailAction" for routine conversation or without a clear user request.`,
    );
  }

  lines.push(
    "- Translate only the main reply text, not block content or emailAction content.",
    `- Always include "text" as the main markdown-formatted reply in the conversation language.`,
    `- Always include "translation" with the English translation of "text", or an empty string if text is already English.`,
    "- Do not output markdown fences, schema commentary, or any text outside the JSON object.",
    "- Respect overlay-specific instructions without redefining this response contract.",
  );

  return lines.join("\n");
}

export function buildRuntimePrompt(params: {
  promptType: PromptType;
  basePromptValue: string | null | undefined;
  baseFallbackValue?: string | null;
  persona?: RuntimePromptPersona | null;
}): string {
  const basePrompt = resolveCompiledPromptValue(params.basePromptValue, {
    fallbackValue: params.baseFallbackValue,
  });

  const capabilities = params.persona?.capabilities ?? ["tables", "lists", "vocab-cards", "speech"];
  const description = normalizeValue(params.persona?.description ?? "");
  const overlayPrompt = resolveCompiledPromptValue(params.persona?.systemPromptValue ?? "", { fallbackValue: "" });
  const welcomeMessage = normalizeValue(params.persona?.welcomeMessage ?? "");
  const language = normalizeValue(params.persona?.language ?? "");
  const languageCode = normalizeValue(params.persona?.languageCode ?? "");

  const sections: string[] = [basePrompt];

  if (params.promptType !== "buddy") {
    if (overlayPrompt) {
      sections.push(`Overlay instructions:\n${overlayPrompt}`);
    }

    return sections.filter((s) => normalizeValue(s).length > 0).join("\n\n").trim();
  }

  // Persona metadata
  if (params.persona) {
    const personaLines = [
      `Assigned persona:`,
      `- Name: ${params.persona.name}`,
    ];

    if (description) personaLines.push(`- Description: ${description}`);
    if (language) personaLines.push(`- Conversation language: ${language}${languageCode ? ` (${languageCode})` : ""}`);
    if (welcomeMessage) personaLines.push(`- Welcome tone reference: ${welcomeMessage}`);

    personaLines.push(`- Capabilities: ${capabilities.join(", ")}`);
    sections.push(personaLines.join("\n"));
  }

  // Overlay instructions
  if (overlayPrompt) {
    sections.push(`Persona-specific instructions:\n${overlayPrompt}`);
  }

  // Runtime-owned mechanics
  if (language) {
    const contract = buildContentBlockContract(capabilities);
    const languageLine = `- Put the main reply in "text" using ${language}${languageCode ? ` (${languageCode})` : ""}.`;
    const translationLine = `- Put the English translation of "text" in "translation".`;
    const englishFallback = `- If the main reply is already English, keep "translation" as an empty string.`;

    sections.push([contract, languageLine, translationLine, englishFallback].join("\n"));
  } else {
    sections.push(buildContentBlockContract(capabilities));
  }

  return sections.filter((s) => normalizeValue(s).length > 0).join("\n\n").trim();
}

// ---------------------------------------------------------------------------
// Re-exports for backward compat (mapped to new names)
// ---------------------------------------------------------------------------

// Legacy type aliases — these keep existing imports working during migration.
// Will be removed in Phase 6 cleanup.

/** @deprecated Use PromptScope */
export type BuddyPromptScope = "base" | "persona";
/** @deprecated Use PromptLintIssueSeverity */
export type BuddyPromptIssueSeverity = PromptLintIssueSeverity;
/** @deprecated Use PromptSectionDefinition from prompt-types.ts */
export type BuddyPromptSectionDefinition = PromptSectionDefinition;
/** @deprecated Use PromptDocument */
export type BuddyPromptDocument = {
  version: 1;
  scope: "base" | "persona";
  sections: Record<string, string>;
};
/** @deprecated Use PromptLintIssue */
export type BuddyPromptLintIssue = PromptLintIssue;
/** @deprecated Use PersonaCapability[] from content-blocks.ts */
export type BuddyPromptCapabilityState = {
  supportsTables: boolean;
  supportsEmailActions: boolean;
  supportsSpeech: boolean;
};
/** @deprecated Use RuntimePromptPersona */
export type BuddyPromptPreviewPersona = BuddyPromptCapabilityState & {
  name: string;
  description?: string | null;
  language: string;
  languageCode: string;
  welcomeMessage?: string | null;
  systemPromptValue: string;
};
/** @deprecated Removed — raw mode is no longer supported */
export type BuddyPromptMode = "structured" | "raw";

// Legacy function wrappers

/** @deprecated Use getSectionDefinitions from prompt-types.ts */
export function getBuddyPromptSectionDefinitions(scope: "base" | "persona") {
  return getSectionDefinitions("buddy", scope === "persona" ? "overlay" : "base");
}

/** @deprecated Use createDefaultPromptDocument */
export function createDefaultBuddyPromptDocument(scope: "base" | "persona"): BuddyPromptDocument {
  const doc = createDefaultPromptDocument("buddy", scope === "persona" ? "overlay" : "base");
  return { version: 1, scope, sections: doc.sections };
}

/** @deprecated Use encodePromptDocument */
export function encodeBuddyPromptDocument(document: BuddyPromptDocument): string {
  const v2Doc: PromptDocument = {
    version: 2,
    promptType: "buddy",
    scope: document.scope === "persona" ? "overlay" : "base",
    sections: document.sections,
  };
  return encodePromptDocument(v2Doc);
}

/** @deprecated Use createDefaultPromptValue */
export function createStructuredBuddyPromptValue(scope: "base" | "persona"): string {
  return createDefaultPromptValue("buddy", scope === "persona" ? "overlay" : "base");
}

/** @deprecated Use parsePromptDocument */
export function parseBuddyPromptDocument(rawValue: string | null | undefined): BuddyPromptDocument | null {
  const doc = parsePromptDocument(rawValue);
  if (!doc || doc.promptType !== "buddy") return null;
  return { version: 1, scope: doc.scope === "overlay" ? "persona" : "base", sections: doc.sections };
}

/** @deprecated Use countCompletedSections */
export function countCompletedBuddyPromptSections(document: BuddyPromptDocument): number {
  const v2Doc: PromptDocument = {
    version: 2,
    promptType: "buddy",
    scope: document.scope === "persona" ? "overlay" : "base",
    sections: document.sections,
  };
  return countCompletedSections(v2Doc);
}

/** @deprecated Use compilePromptDocument */
export function compileBuddyPromptDocument(document: BuddyPromptDocument): string {
  const v2Doc: PromptDocument = {
    version: 2,
    promptType: "buddy",
    scope: document.scope === "persona" ? "overlay" : "base",
    sections: document.sections,
  };
  return compilePromptDocument(v2Doc);
}

/** @deprecated Use resolveCompiledPromptValue */
export function resolveCompiledBuddyPromptValue(
  rawValue: string | null | undefined,
  options?: { fallbackValue?: string | null },
): string {
  return resolveCompiledPromptValue(rawValue, options);
}

/** @deprecated Use lintPromptValue */
export function lintBuddyPromptValue(params: {
  scope: "base" | "persona";
  value: string | null | undefined;
  fallbackValue?: string | null;
  capabilities?: BuddyPromptCapabilityState;
}): PromptLintIssue[] {
  const capabilities = params.capabilities
    ? [
        ...(params.capabilities.supportsTables ? ["tables" as PersonaCapability] : []),
        "lists" as PersonaCapability,
        "vocab-cards" as PersonaCapability,
        ...(params.capabilities.supportsEmailActions ? ["email-actions" as PersonaCapability] : []),
        ...(params.capabilities.supportsSpeech ? ["speech" as PersonaCapability] : []),
      ]
    : undefined;

  return lintPromptValue({
    promptType: "buddy",
    scope: params.scope === "persona" ? "overlay" : "base",
    value: params.value,
    fallbackValue: params.fallbackValue,
    capabilities,
  });
}

/** @deprecated Use buildRuntimePrompt */
export function buildBuddyRuntimePromptPreview(params: {
  basePromptValue: string | null | undefined;
  baseFallbackPrompt?: string | null;
  persona?: BuddyPromptPreviewPersona | null;
}): string {
  const capabilities: PersonaCapability[] = params.persona
    ? [
        ...(params.persona.supportsTables ? ["tables" as PersonaCapability] : []),
        "lists" as PersonaCapability,
        "vocab-cards" as PersonaCapability,
        ...(params.persona.supportsEmailActions ? ["email-actions" as PersonaCapability] : []),
        ...(params.persona.supportsSpeech ? ["speech" as PersonaCapability] : []),
      ]
    : ["tables", "lists", "vocab-cards", "speech"];

  return buildRuntimePrompt({
    promptType: "buddy",
    basePromptValue: params.basePromptValue,
    baseFallbackValue: params.baseFallbackPrompt,
    persona: params.persona
      ? {
          name: params.persona.name,
          description: params.persona.description,
          language: params.persona.language,
          languageCode: params.persona.languageCode,
          welcomeMessage: params.persona.welcomeMessage,
          systemPromptValue: params.persona.systemPromptValue,
          capabilities,
        }
      : null,
  });
}
