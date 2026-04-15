/**
 * Content Block Types & Validators
 *
 * Typed discriminated union for structured content blocks returned by Buddy AI.
 * The client renders valid blocks with type-specific components and falls back
 * to markdown parsing of the `text` field for invalid/missing blocks.
 */

// ---------------------------------------------------------------------------
// Capability registry
// ---------------------------------------------------------------------------

export const PERSONA_CAPABILITIES = [
  "tables",
  "lists",
  "quizzes",
  "vocab-cards",
  "comparisons",
  "grammar-patterns",
  "email-actions",
  "speech",
] as const;

export type PersonaCapability = (typeof PERSONA_CAPABILITIES)[number];

export const DEFAULT_CAPABILITIES: PersonaCapability[] = [
  "tables",
  "lists",
  "vocab-cards",
  "speech",
];

/** Map from capability to the content block type it enables (null = not a block). */
export const CAPABILITY_BLOCK_MAP: Record<PersonaCapability, ContentBlockType | null> = {
  tables: "table",
  lists: "list",
  quizzes: "quiz",
  "vocab-cards": "vocab-card",
  comparisons: "comparison",
  "grammar-patterns": "grammar",
  "email-actions": null,
  speech: null,
};

export const CAPABILITY_LABELS: Record<PersonaCapability, string> = {
  tables: "Tables",
  lists: "Lists",
  quizzes: "Quizzes",
  "vocab-cards": "Vocabulary Cards",
  comparisons: "Comparisons",
  "grammar-patterns": "Grammar Patterns",
  "email-actions": "Email Actions",
  speech: "Speech / Voice",
};

// ---------------------------------------------------------------------------
// Content block types
// ---------------------------------------------------------------------------

export type ContentBlockType = "table" | "list" | "quiz" | "vocab-card" | "comparison" | "grammar";

export type TableBlock = {
  type: "table";
  headers: string[];
  rows: string[][];
};

export type ListBlock = {
  type: "list";
  style: "ordered" | "unordered";
  items: string[];
};

export type QuizOption = {
  label: string;
  correct?: boolean;
};

export type QuizBlock = {
  type: "quiz";
  question: string;
  options: QuizOption[];
  explanation?: string;
};

export type VocabCardBlock = {
  type: "vocab-card";
  word: string;
  translation: string;
  phonetic?: string;
  example?: string;
  gender?: string;
};

export type ComparisonColumn = {
  label: string;
  items: string[];
};

export type ComparisonBlock = {
  type: "comparison";
  columns: ComparisonColumn[];
};

export type GrammarBlock = {
  type: "grammar";
  pattern: string;
  explanation: string;
  examples: string[];
};

export type ContentBlock =
  | TableBlock
  | ListBlock
  | QuizBlock
  | VocabCardBlock
  | ComparisonBlock
  | GrammarBlock;

// ---------------------------------------------------------------------------
// Buddy AI response shape
// ---------------------------------------------------------------------------

export type BuddyEmailAction = {
  subject: string;
  message: string;
};

export type BuddyAIResponse = {
  text: string;
  translation: string;
  blocks?: ContentBlock[];
  emailAction?: BuddyEmailAction;
};

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateTableBlock(block: unknown): TableBlock | null {
  if (!isRecord(block)) return null;
  if (block.type !== "table") return null;
  if (!isStringArray(block.headers) || block.headers.length === 0) return null;
  if (!Array.isArray(block.rows)) return null;

  const validRows = block.rows.filter(
    (row): row is string[] => isStringArray(row) && row.length === (block.headers as string[]).length,
  );

  if (validRows.length === 0) return null;

  return {
    type: "table",
    headers: block.headers as string[],
    rows: validRows,
  };
}

export function validateListBlock(block: unknown): ListBlock | null {
  if (!isRecord(block)) return null;
  if (block.type !== "list") return null;
  if (block.style !== "ordered" && block.style !== "unordered") return null;
  if (!isStringArray(block.items) || block.items.length === 0) return null;

  return {
    type: "list",
    style: block.style,
    items: block.items as string[],
  };
}

export function validateQuizBlock(block: unknown): QuizBlock | null {
  if (!isRecord(block)) return null;
  if (block.type !== "quiz") return null;
  if (!isNonEmptyString(block.question)) return null;
  if (!Array.isArray(block.options) || block.options.length < 2) return null;

  const validOptions = block.options.filter(
    (option): option is QuizOption =>
      isRecord(option) && isNonEmptyString((option as Record<string, unknown>).label),
  ).map((option) => ({
    label: (option as Record<string, unknown>).label as string,
    ...(typeof (option as Record<string, unknown>).correct === "boolean"
      ? { correct: (option as Record<string, unknown>).correct as boolean }
      : {}),
  }));

  if (validOptions.length < 2) return null;

  return {
    type: "quiz",
    question: block.question as string,
    options: validOptions,
    ...(isNonEmptyString(block.explanation) ? { explanation: block.explanation as string } : {}),
  };
}

export function validateVocabCardBlock(block: unknown): VocabCardBlock | null {
  if (!isRecord(block)) return null;
  if (block.type !== "vocab-card") return null;
  if (!isNonEmptyString(block.word)) return null;
  if (!isNonEmptyString(block.translation)) return null;

  return {
    type: "vocab-card",
    word: block.word as string,
    translation: block.translation as string,
    ...(isNonEmptyString(block.phonetic) ? { phonetic: block.phonetic as string } : {}),
    ...(isNonEmptyString(block.example) ? { example: block.example as string } : {}),
    ...(isNonEmptyString(block.gender) ? { gender: block.gender as string } : {}),
  };
}

export function validateComparisonBlock(block: unknown): ComparisonBlock | null {
  if (!isRecord(block)) return null;
  if (block.type !== "comparison") return null;
  if (!Array.isArray(block.columns) || block.columns.length < 2) return null;

  const validColumns = block.columns.filter(
    (col): col is ComparisonColumn =>
      isRecord(col) && isNonEmptyString((col as Record<string, unknown>).label) && isStringArray((col as Record<string, unknown>).items),
  ).map((col) => ({
    label: (col as Record<string, unknown>).label as string,
    items: (col as Record<string, unknown>).items as string[],
  }));

  if (validColumns.length < 2) return null;

  return {
    type: "comparison",
    columns: validColumns,
  };
}

export function validateGrammarBlock(block: unknown): GrammarBlock | null {
  if (!isRecord(block)) return null;
  if (block.type !== "grammar") return null;
  if (!isNonEmptyString(block.pattern)) return null;
  if (!isNonEmptyString(block.explanation)) return null;
  if (!isStringArray(block.examples) || block.examples.length === 0) return null;

  return {
    type: "grammar",
    pattern: block.pattern as string,
    explanation: block.explanation as string,
    examples: block.examples as string[],
  };
}

const BLOCK_VALIDATORS: Record<ContentBlockType, (block: unknown) => ContentBlock | null> = {
  table: validateTableBlock,
  list: validateListBlock,
  quiz: validateQuizBlock,
  "vocab-card": validateVocabCardBlock,
  comparison: validateComparisonBlock,
  grammar: validateGrammarBlock,
};

/**
 * Validate an array of raw content blocks from AI output.
 * Returns only valid blocks; invalid/unknown types are silently dropped.
 */
export function validateContentBlocks(rawBlocks: unknown): ContentBlock[] {
  if (!Array.isArray(rawBlocks)) return [];

  const validated: ContentBlock[] = [];

  for (const rawBlock of rawBlocks) {
    if (!isRecord(rawBlock) || !isNonEmptyString(rawBlock.type)) continue;

    const blockType = rawBlock.type as string;
    const validator = BLOCK_VALIDATORS[blockType as ContentBlockType];

    if (!validator) continue;

    const validBlock = validator(rawBlock);
    if (validBlock) {
      validated.push(validBlock);
    }
  }

  return validated;
}

/**
 * Validate a full Buddy AI response object.
 * Ensures `text` and `translation` exist; validates blocks and emailAction.
 */
export function validateBuddyAIResponse(raw: unknown): BuddyAIResponse | null {
  if (!isRecord(raw)) return null;
  if (!isNonEmptyString(raw.text)) return null;

  const response: BuddyAIResponse = {
    text: raw.text as string,
    translation: typeof raw.translation === "string" ? raw.translation as string : "",
  };

  if (raw.blocks !== undefined) {
    const validBlocks = validateContentBlocks(raw.blocks);
    if (validBlocks.length > 0) {
      response.blocks = validBlocks;
    }
  }

  // Legacy: accept top-level "table" for backward compat with V1 contract
  if (response.blocks === undefined && isRecord(raw.table)) {
    const legacyTable = validateTableBlock({ type: "table", ...raw.table });
    if (legacyTable) {
      response.blocks = [legacyTable];
    }
  }

  if (isRecord(raw.emailAction)) {
    if (isNonEmptyString(raw.emailAction.subject) && isNonEmptyString(raw.emailAction.message)) {
      response.emailAction = {
        subject: raw.emailAction.subject as string,
        message: raw.emailAction.message as string,
      };
    }
  }

  return response;
}

/**
 * Validate a capabilities array. Returns only known capability strings.
 */
export function normalizeCapabilities(raw: unknown): PersonaCapability[] {
  if (!Array.isArray(raw)) return [...DEFAULT_CAPABILITIES];

  const valid = raw.filter(
    (item): item is PersonaCapability =>
      typeof item === "string" && PERSONA_CAPABILITIES.includes(item as PersonaCapability),
  );

  return valid.length > 0 ? valid : [...DEFAULT_CAPABILITIES];
}

/**
 * Convert legacy boolean flags to capabilities array.
 */
export function legacyFlagsToCapabilities(flags: {
  supportsTables?: boolean;
  supportsEmailActions?: boolean;
  supportsSpeech?: boolean;
}): PersonaCapability[] {
  const capabilities: PersonaCapability[] = [];

  if (flags.supportsTables !== false) capabilities.push("tables");
  capabilities.push("lists");
  capabilities.push("vocab-cards");
  if (flags.supportsEmailActions) capabilities.push("email-actions");
  if (flags.supportsSpeech !== false) capabilities.push("speech");

  return capabilities;
}

/**
 * Convert capabilities array to legacy boolean flags for backward compat.
 */
export function capabilitiesToLegacyFlags(capabilities: PersonaCapability[]) {
  return {
    supportsTables: capabilities.includes("tables"),
    supportsEmailActions: capabilities.includes("email-actions"),
    supportsSpeech: capabilities.includes("speech"),
  };
}
