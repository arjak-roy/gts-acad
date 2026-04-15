import { LANGUAGE_LAB_DEFAULT_CONFIG } from "@/lib/language-lab/default-config";
import { buildRuntimePrompt } from "@/lib/language-lab/prompt-framework";
import type { CandidateBuddyPersona } from "@/lib/language-lab/types";
import { normalizeCapabilities, type BuddyAIResponse, validateBuddyAIResponse } from "@/lib/language-lab/content-blocks";

type BuddyConversationEnrollmentContext = {
  batchId: string;
  batchCode: string;
  batchName: string;
  programName: string;
  courseName: string;
  campus: string | null;
};

type BuddyConversationRuntimeSettings = {
  geminiApiKey: string;
  buddyConversationModelId: string;
  buddySystemPrompt: string;
};

type BuddyConversationServiceInput = {
  message: string;
  enrollment: BuddyConversationEnrollmentContext;
  persona: CandidateBuddyPersona;
  settings: BuddyConversationRuntimeSettings;
  signal?: AbortSignal;
};

type BuddyGeminiRequestOptions = {
  structuredOutput: boolean;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

function isQuizRequest(message: string) {
  return /\bquiz\b|multiple[-\s]?choice|\bmcq\b|test me|question me/i.test(message);
}

function stripMarkdownFence(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith("```")) {
    return trimmedValue;
  }

  return trimmedValue.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function extractBalancedJsonObjects(source: string) {
  const normalizedSource = stripMarkdownFence(source);
  const objects: string[] = [];
  let objectStart = -1;
  let depth = 0;
  let isInsideString = false;
  let isEscaped = false;

  for (let index = 0; index < normalizedSource.length; index += 1) {
    const character = normalizedSource[index] ?? "";

    if (isInsideString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (character === "\\") {
        isEscaped = true;
        continue;
      }

      if (character === '"') {
        isInsideString = false;
      }

      continue;
    }

    if (character === '"') {
      isInsideString = true;
      continue;
    }

    if (character === "{") {
      if (depth === 0) {
        objectStart = index;
      }

      depth += 1;
      continue;
    }

    if (character === "}" && depth > 0) {
      depth -= 1;

      if (depth === 0 && objectStart >= 0) {
        objects.push(normalizedSource.slice(objectStart, index + 1));
        objectStart = -1;
      }
    }
  }

  return objects;
}

function decodeJsonStringValue(source: string, key: string) {
  const keyIndex = source.indexOf(`"${key}"`);

  if (keyIndex < 0) {
    return "";
  }

  const colonIndex = source.indexOf(":", keyIndex);

  if (colonIndex < 0) {
    return "";
  }

  let cursor = colonIndex + 1;

  while (cursor < source.length && /\s/.test(source[cursor] ?? "")) {
    cursor += 1;
  }

  if (source[cursor] !== '"') {
    return "";
  }

  cursor += 1;
  let result = "";
  let isEscaped = false;

  while (cursor < source.length) {
    const character = source[cursor] ?? "";

    if (isEscaped) {
      if (character === "n") {
        result += "\n";
      } else if (character === "r") {
        result += "\r";
      } else if (character === "t") {
        result += "\t";
      } else if (character === "u") {
        const hexValue = source.slice(cursor + 1, cursor + 5);

        if (/^[0-9a-fA-F]{4}$/.test(hexValue)) {
          result += String.fromCharCode(parseInt(hexValue, 16));
          cursor += 4;
        }
      } else {
        result += character;
      }

      isEscaped = false;
      cursor += 1;
      continue;
    }

    if (character === "\\") {
      isEscaped = true;
      cursor += 1;
      continue;
    }

    if (character === '"') {
      break;
    }

    result += character;
    cursor += 1;
  }

  return result;
}

function parseBuddyResponsePayload(rawText: string) {
  const normalizedText = stripMarkdownFence(rawText);

  try {
    return JSON.parse(normalizedText) as unknown;
  } catch {
    const balancedObjects = extractBalancedJsonObjects(normalizedText);

    for (let index = balancedObjects.length - 1; index >= 0; index -= 1) {
      try {
        return JSON.parse(balancedObjects[index] ?? "") as unknown;
      } catch {
        continue;
      }
    }
  }

  throw new Error("Buddy returned an unreadable response.");
}

function buildMalformedPayloadFallback(rawText: string): BuddyAIResponse | null {
  const normalizedText = stripMarkdownFence(rawText);
  const text = decodeJsonStringValue(normalizedText, "text").trim();

  if (!text) {
    return null;
  }

  return validateBuddyAIResponse({
    text,
    translation: decodeJsonStringValue(normalizedText, "translation").trim(),
  });
}

function getGeminiErrorMessage(payload: GeminiGenerateContentResponse | null, fallback: string) {
  return payload?.error?.message?.trim() || fallback;
}

function getGeminiResponseText(payload: GeminiGenerateContentResponse | null) {
  return payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
}

function normalizeGeminiModelId(modelId: string) {
  return modelId.trim().replace(/^models\//i, "");
}

const BUDDY_RESPONSE_SCHEMA = {
  type: "OBJECT",
  propertyOrdering: ["text", "translation", "blocks", "table", "emailAction"],
  required: ["text", "translation"],
  properties: {
    text: {
      type: "STRING",
      description: "Primary learner-facing reply.",
    },
    translation: {
      type: "STRING",
      description: "English translation of the main reply. Use an empty string when the main reply is already in English.",
    },
    blocks: {
      type: "ARRAY",
      description: "Optional structured study artifacts. Each item must include a supported type value.",
      items: {
        type: "OBJECT",
        propertyOrdering: ["type", "headers", "rows", "style", "items", "question", "options", "explanation", "word", "translation", "phonetic", "example", "gender", "columns", "pattern", "examples"],
        required: ["type"],
        properties: {
          type: {
            type: "STRING",
            enum: ["table", "list", "quiz", "vocab-card", "comparison", "grammar"],
          },
          headers: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
          rows: {
            type: "ARRAY",
            items: {
              type: "ARRAY",
              items: { type: "STRING" },
            },
          },
          style: {
            type: "STRING",
            enum: ["ordered", "unordered", "numbered", "bullet", "bulleted"],
          },
          items: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
          question: { type: "STRING" },
          options: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                label: { type: "STRING" },
                correct: { type: "BOOLEAN" },
              },
            },
          },
          explanation: { type: "STRING" },
          word: { type: "STRING" },
          translation: { type: "STRING" },
          phonetic: { type: "STRING" },
          example: { type: "STRING" },
          gender: { type: "STRING" },
          columns: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                label: { type: "STRING" },
                items: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                },
              },
            },
          },
          pattern: { type: "STRING" },
          examples: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
        },
      },
    },
    table: {
      type: "OBJECT",
      propertyOrdering: ["headers", "rows"],
      description: 'Optional legacy simple table object with "headers" and "rows".',
      properties: {
        headers: {
          type: "ARRAY",
          items: { type: "STRING" },
        },
        rows: {
          type: "ARRAY",
          items: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
        },
      },
    },
    emailAction: {
      type: "OBJECT",
      propertyOrdering: ["subject", "message"],
      description: "Optional email draft for personas that support email actions.",
      properties: {
        subject: { type: "STRING" },
        message: { type: "STRING" },
      },
    },
  },
} as const;

function buildBuddySystemPrompt(input: BuddyConversationServiceInput) {
  const capabilities = normalizeCapabilities(input.persona.capabilities);
  const runtimePrompt = buildRuntimePrompt({
    promptType: "buddy",
    basePromptValue: input.settings.buddySystemPrompt,
    baseFallbackValue: LANGUAGE_LAB_DEFAULT_CONFIG.prompts.buddy,
    persona: {
      name: input.persona.name,
      description: input.persona.description,
      language: input.persona.language,
      languageCode: input.persona.languageCode,
      welcomeMessage: input.persona.welcomeMessage,
      systemPromptValue: input.persona.systemPrompt ?? "",
      capabilities,
    },
  });

  const lines = [
    runtimePrompt,
    "",
    "Learner context:",
    `- Program: ${input.enrollment.programName}`,
    `- Course: ${input.enrollment.courseName}`,
    `- Batch: ${input.enrollment.batchName} (${input.enrollment.batchCode})`,
    `- Campus: ${input.enrollment.campus ?? "Not specified"}`,
    "",
    "Response shaping:",
    '- Keep the reply concise, scannable, and mobile-friendly.',
    '- Prefer one high-value structured artifact over several decorative ones.',
    '- Include at most 3 entries in "blocks".',
    '- Keep lists to 6 items or fewer.',
    '- Keep quiz options to 4 choices when possible.',
    '- For quiz requests, prefer a single quick question over a long worksheet unless the learner explicitly asks for more.',
    '- Keep tables to 4 columns and 6 rows or fewer.',
    '- Keep vocab cards short and literal.',
    '- Do not repeat the full same explanation in both "text" and block content.',
  ];

  if (capabilities.includes('quizzes') && isQuizRequest(input.message)) {
    lines.push(
      '',
      'Quiz-specific shaping:',
      '- Return exactly one quiz block.',
      '- Keep the quiz concise: 1 question, 3 or 4 short options, and one short explanation.',
      '- Do not add extra tables, lists, or more than one quiz block unless the learner explicitly asks for them.',
    );
  }

  return lines.join("\n");
}

function buildGeminiRequestBody(input: BuddyConversationServiceInput, options: BuddyGeminiRequestOptions) {
  const quizMode = isQuizRequest(input.message) && normalizeCapabilities(input.persona.capabilities).includes('quizzes');
  const generationConfig: Record<string, unknown> = {
    temperature: quizMode ? 0.15 : 0.2,
    maxOutputTokens: quizMode ? 900 : 1600,
  };

  if (options.structuredOutput) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = BUDDY_RESPONSE_SCHEMA;
  }

  return {
    systemInstruction: {
      parts: [{ text: buildBuddySystemPrompt(input) }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: input.message }],
      },
    ],
    generationConfig,
  };
}

async function sendGeminiRequest(
  input: BuddyConversationServiceInput,
  normalizedMessage: string,
  normalizedModelId: string,
  options: BuddyGeminiRequestOptions,
) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizedModelId)}:generateContent?key=${encodeURIComponent(input.settings.geminiApiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: input.signal,
        cache: "no-store",
        body: JSON.stringify(buildGeminiRequestBody({
          ...input,
          message: normalizedMessage,
        }, options)),
      },
    );

    const payload = (await response.json().catch(() => null)) as GeminiGenerateContentResponse | null;

    return { response, payload };
  } catch {
    throw new Error("Buddy could not reach the model right now.");
  }
}

function normalizeBuddyConversationResponse(rawText: string) {
  const validatedResponse = validateBuddyAIResponse(parseBuddyResponsePayload(rawText));

  if (validatedResponse) {
    return validatedResponse;
  }

  const fallbackResponse = buildMalformedPayloadFallback(rawText);

  if (fallbackResponse) {
    return fallbackResponse;
  }

  throw new Error("Buddy returned an invalid response.");
}

export async function requestBuddyConversationService(input: BuddyConversationServiceInput): Promise<BuddyAIResponse> {
  const normalizedModelId = normalizeGeminiModelId(input.settings.buddyConversationModelId);

  if (!input.settings.geminiApiKey || !normalizedModelId) {
    throw new Error("Buddy runtime is not configured right now.");
  }

  const normalizedMessage = input.message.trim();

  if (!normalizedMessage) {
    throw new Error("Buddy message is required.");
  }

  let geminiResult;

  geminiResult = await sendGeminiRequest(input, normalizedMessage, normalizedModelId, { structuredOutput: true });

  if (!geminiResult.response.ok && /invalid argument/i.test(getGeminiErrorMessage(geminiResult.payload, ""))) {
    geminiResult = await sendGeminiRequest(input, normalizedMessage, normalizedModelId, { structuredOutput: false });
  }

  const { response, payload } = geminiResult;

  if (!response.ok) {
    throw new Error(getGeminiErrorMessage(payload, "Buddy could not respond right now."));
  }

  const rawText = getGeminiResponseText(payload).trim();

  if (!rawText) {
    throw new Error("Buddy returned an empty response.");
  }

  return normalizeBuddyConversationResponse(rawText);
}