import "server-only";

import { getRuntimeSettingValue } from "@/services/settings/runtime";
import {
  getAiProvider,
  getOpenAIClient,
  getGeminiModel,
  getAiModelName,
  getMaxQuestionsPerRequest,
} from "@/services/ai/client";
import { getToolsForQuestionType, QUESTION_TOOL_DEFINITIONS, QUESTION_TYPE_TO_TOOL_NAME } from "@/services/ai/tool-definitions";
import { parseToolCallToQuestion } from "@/services/ai/response-parser";
import {
  generateAssessmentPoolCode,
  createAssessmentPoolService,
  addQuestionService,
} from "@/services/assessment-pool/commands";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";

import type {
  AiGenerateQuestionsRequest,
  AiGenerateQuestionsResponse,
  AiCreateAssessmentRequest,
  AiCreateAssessmentResponse,
  AiGeneratedQuestion,
} from "@/services/ai/types";

const DIFFICULTY_GUIDANCE: Record<string, string> = {
  EASY: "Generate straightforward questions appropriate for beginners. Use clear language and test basic recall.",
  MEDIUM: "Generate moderately challenging questions that test understanding and application of concepts.",
  HARD: "Generate complex questions requiring analysis, synthesis, or deep domain expertise.",
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  MCQ: "Multiple Choice (MCQ)",
  NUMERIC: "Numeric",
  ESSAY: "Essay",
  FILL_IN_THE_BLANK: "Fill in the Blank",
  MULTI_INPUT_REASONING: "Multi-Input Reasoning",
  TWO_PART_ANALYSIS: "Two-Part Analysis",
};

/**
 * Check whether AI features are enabled in settings. Throws if disabled.
 */
export async function assertAiEnabled(): Promise<void> {
  const enabled = await getRuntimeSettingValue<boolean>("ai.enable_ai_features", false);
  if (!enabled) {
    throw new Error("AI features are currently disabled. Enable them in Settings → AI Features.");
  }
}

/**
 * Build the system prompt supporting single or mixed question types.
 */
function buildSystemPrompt(request: AiGenerateQuestionsRequest): string {
  const types = request.questionTypes ?? [request.questionType];
  const isMixed = types.length > 1;
  const difficultyGuidance = DIFFICULTY_GUIDANCE[request.difficultyLevel] ?? DIFFICULTY_GUIDANCE.MEDIUM;

  const typeLabels = types.map((t) => QUESTION_TYPE_LABELS[t] ?? t);
  const toolNames = types.map((t) => QUESTION_TYPE_TO_TOOL_NAME[t]).filter(Boolean);

  const typeInstruction = isMixed
    ? `Generate exactly ${request.questionCount} questions total, using a good mix of these types: ${typeLabels.join(", ")}. Distribute the questions across the types, favouring variety.`
    : `Generate exactly ${request.questionCount} ${typeLabels[0]} question(s).`;

  const toolInstruction = isMixed
    ? `- You MUST call the question creation functions exactly ${request.questionCount} time(s) total, choosing from: ${toolNames.join(", ")}.`
    : `- You MUST call the "${toolNames[0]}" function exactly ${request.questionCount} time(s).`;

  return [
    "You are an expert assessment question author for an educational platform.",
    `${typeInstruction} Difficulty: ${request.difficultyLevel}.`,
    "",
    difficultyGuidance,
    "",
    "IMPORTANT RULES:",
    toolInstruction,
    "- Each question must be unique and substantive.",
    "- Include a clear explanation for each question where applicable.",
    "- Make questions educational, unambiguous, and professionally worded.",
    "- For MCQ: always provide exactly 4 options labeled A through D.",
    "- For Fill in the Blank: use ____ in the question text to indicate blank positions.",
    "- For Two-Part Analysis: provide a scenario and at least 3 shared options.",
    "- For Multi-Input Reasoning: provide a passage and at least 2 input fields.",
    "- Assign appropriate marks (typically 1-5 depending on difficulty).",
    "",
    "The user will provide a prompt describing the topic or content area for the questions.",
  ].join("\n");
}

/**
 * Get tools for one or multiple question types.
 */
function getToolsForTypes(types?: string[]) {
  if (!types || types.length === 0) return QUESTION_TOOL_DEFINITIONS;
  if (types.length === 1) return getToolsForQuestionType(types[0]);
  // Merge tools for all selected types, dedup by name
  const seen = new Set<string>();
  return QUESTION_TOOL_DEFINITIONS.filter((tool) => {
    if (tool.type !== "function") return false;
    if (seen.has(tool.function.name)) return false;
    const isRelevant = types.some((t) => QUESTION_TYPE_TO_TOOL_NAME[t] === tool.function.name);
    if (isRelevant) seen.add(tool.function.name);
    return isRelevant;
  });
}

/**
 * Generate questions using AI (preview only — not persisted).
 * Dispatches to OpenAI or Gemini based on the configured provider.
 */
export async function generateQuestionsService(
  request: AiGenerateQuestionsRequest,
): Promise<AiGenerateQuestionsResponse> {
  await assertAiEnabled();

  const maxQuestions = await getMaxQuestionsPerRequest();
  const questionCount = Math.min(request.questionCount, maxQuestions);
  const cappedRequest = { ...request, questionCount };

  const provider = await getAiProvider();

  if (provider === "openai") {
    return generateWithOpenAI(cappedRequest);
  }

  return generateWithGemini(cappedRequest);
}

/**
 * Stream-generate questions yielding each one as it's parsed.
 * Used by the streaming SSE endpoint.
 */
export async function* streamGenerateQuestions(
  request: AiGenerateQuestionsRequest,
): AsyncGenerator<{ type: "question"; data: AiGeneratedQuestion } | { type: "done"; model: string; promptTokens: number; completionTokens: number } | { type: "error"; message: string }> {
  await assertAiEnabled();

  const maxQuestions = await getMaxQuestionsPerRequest();
  const questionCount = Math.min(request.questionCount, maxQuestions);
  const cappedRequest = { ...request, questionCount };

  const provider = await getAiProvider();

  try {
    if (provider === "openai") {
      yield* streamWithOpenAI(cappedRequest);
    } else {
      yield* streamWithGemini(cappedRequest);
    }
  } catch (error) {
    yield { type: "error", message: error instanceof Error ? error.message : "Generation failed." };
  }
}

// ─── OpenAI Implementation ──────────────────────────────────────────────────

async function generateWithOpenAI(
  request: AiGenerateQuestionsRequest,
): Promise<AiGenerateQuestionsResponse> {
  const client = await getOpenAIClient();
  const model = await getAiModelName();
  const types = request.questionTypes ?? [request.questionType];
  const tools = getToolsForTypes(types);
  const systemPrompt = buildSystemPrompt(request);

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: request.prompt },
    ],
    tools,
    tool_choice: "required",
    temperature: 0.7,
    max_tokens: 4096,
  });

  const message = response.choices[0]?.message;
  const toolCalls = message?.tool_calls ?? [];

  const questions: AiGeneratedQuestion[] = [];
  for (const toolCall of toolCalls) {
    if (toolCall.type !== "function") continue;

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
    } catch {
      console.warn("Failed to parse tool call arguments:", toolCall.function.arguments);
      continue;
    }

    const question = parseToolCallToQuestion(toolCall.function.name, args);
    if (question) questions.push(question);
  }

  if (questions.length === 0) {
    throw new Error("AI did not generate any valid questions. Try rephrasing your prompt or adjusting the settings.");
  }

  return {
    questions,
    model,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
  };
}

async function* streamWithOpenAI(
  request: AiGenerateQuestionsRequest,
): AsyncGenerator<{ type: "question"; data: AiGeneratedQuestion } | { type: "done"; model: string; promptTokens: number; completionTokens: number }> {
  // OpenAI streaming with tool calls: accumulate each tool call's chunks, emit when complete
  const client = await getOpenAIClient();
  const model = await getAiModelName();
  const types = request.questionTypes ?? [request.questionType];
  const tools = getToolsForTypes(types);
  const systemPrompt = buildSystemPrompt(request);

  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: request.prompt },
    ],
    tools,
    tool_choice: "required",
    temperature: 0.7,
    max_tokens: 4096,
    stream: true,
  });

  // Accumulate tool calls by index
  const toolCallBuffers: Map<number, { name: string; args: string }> = new Map();
  const emittedIndices = new Set<number>();

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta?.tool_calls) continue;

    for (const tc of delta.tool_calls) {
      const idx = tc.index;
      if (!toolCallBuffers.has(idx)) {
        toolCallBuffers.set(idx, { name: "", args: "" });
      }
      const buf = toolCallBuffers.get(idx)!;
      if (tc.function?.name) buf.name = tc.function.name;
      if (tc.function?.arguments) buf.args += tc.function.arguments;
    }

    // Try to parse any completed tool calls
    for (const [idx, buf] of toolCallBuffers) {
      if (emittedIndices.has(idx) || !buf.name || !buf.args) continue;
      try {
        const args = JSON.parse(buf.args) as Record<string, unknown>;
        const question = parseToolCallToQuestion(buf.name, args);
        if (question) {
          emittedIndices.add(idx);
          yield { type: "question", data: question };
        }
      } catch {
        // JSON incomplete, keep accumulating
      }
    }
  }

  // Emit any remaining buffered tool calls
  for (const [idx, buf] of toolCallBuffers) {
    if (emittedIndices.has(idx) || !buf.name) continue;
    try {
      const args = JSON.parse(buf.args) as Record<string, unknown>;
      const question = parseToolCallToQuestion(buf.name, args);
      if (question) {
        emittedIndices.add(idx);
        yield { type: "question", data: question };
      }
    } catch {
      console.warn("Failed to parse final tool call buffer:", buf);
    }
  }

  yield { type: "done", model, promptTokens: 0, completionTokens: 0 };
}

// ─── Gemini Implementation ──────────────────────────────────────────────────

import { FunctionCallingMode, type FunctionDeclarationSchema } from "@google/generative-ai";

/**
 * Convert our OpenAI-style tool definitions into Gemini function declarations.
 */
function buildGeminiFunctionDeclarations(types?: string[]) {
  const tools = getToolsForTypes(types);
  return tools
    .filter((t) => t.type === "function")
    .map((t) => ({
      name: t.function.name,
      description: t.function.description ?? "",
      parameters: t.function.parameters as unknown as FunctionDeclarationSchema,
    }));
}

async function generateWithGemini(
  request: AiGenerateQuestionsRequest,
): Promise<AiGenerateQuestionsResponse> {
  const geminiModel = await getGeminiModel();
  const modelName = await getAiModelName();
  const systemPrompt = buildSystemPrompt(request);
  const types = request.questionTypes ?? [request.questionType];
  const functionDeclarations = buildGeminiFunctionDeclarations(types);

  const result = await geminiModel.generateContent({
    contents: [{ role: "user", parts: [{ text: request.prompt }] }],
    systemInstruction: { role: "model", parts: [{ text: systemPrompt }] },
    tools: [{ functionDeclarations }],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.ANY } },
    generationConfig: { temperature: 0.7 },
  });

  const response = result.response;
  const parts = response.candidates?.[0]?.content?.parts ?? [];

  const questions: AiGeneratedQuestion[] = [];
  for (const part of parts) {
    if (!part.functionCall) continue;

    const args = (part.functionCall.args ?? {}) as Record<string, unknown>;
    const question = parseToolCallToQuestion(part.functionCall.name, args);
    if (question) questions.push(question);
  }

  if (questions.length === 0) {
    throw new Error("AI did not generate any valid questions. Try rephrasing your prompt or adjusting the settings.");
  }

  const usage = response.usageMetadata;

  return {
    questions,
    model: modelName,
    promptTokens: usage?.promptTokenCount ?? 0,
    completionTokens: usage?.candidatesTokenCount ?? 0,
  };
}

async function* streamWithGemini(
  request: AiGenerateQuestionsRequest,
): AsyncGenerator<{ type: "question"; data: AiGeneratedQuestion } | { type: "done"; model: string; promptTokens: number; completionTokens: number }> {
  const geminiModel = await getGeminiModel();
  const modelName = await getAiModelName();
  const systemPrompt = buildSystemPrompt(request);
  const types = request.questionTypes ?? [request.questionType];
  const functionDeclarations = buildGeminiFunctionDeclarations(types);

  const result = await geminiModel.generateContentStream({
    contents: [{ role: "user", parts: [{ text: request.prompt }] }],
    systemInstruction: { role: "model", parts: [{ text: systemPrompt }] },
    tools: [{ functionDeclarations }],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.ANY } },
    generationConfig: { temperature: 0.7 },
  });

  for await (const chunk of result.stream) {
    const parts = chunk.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (!part.functionCall) continue;
      const args = (part.functionCall.args ?? {}) as Record<string, unknown>;
      const question = parseToolCallToQuestion(part.functionCall.name, args);
      if (question) {
        yield { type: "question", data: question };
      }
    }
  }

  const finalResponse = await result.response;
  const usage = finalResponse.usageMetadata;
  yield { type: "done", model: modelName, promptTokens: usage?.promptTokenCount ?? 0, completionTokens: usage?.candidatesTokenCount ?? 0 };
}

/**
 * Create an assessment pool with AI-generated questions.
 * Records an AiAssessmentJob for audit and tracking.
 */
export async function createAiAssessmentService(
  request: AiCreateAssessmentRequest,
  options?: { actorUserId?: string },
): Promise<AiCreateAssessmentResponse> {
  await assertAiEnabled();

  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const code = await generateAssessmentPoolCode(request.title);

  const pool = await createAssessmentPoolService(
    {
      code,
      title: request.title,
      description: request.description ?? "",
      courseId: request.courseId ?? "",
      questionType: request.questionType as "MCQ" | "NUMERIC" | "ESSAY" | "FILL_IN_THE_BLANK" | "MULTI_INPUT_REASONING" | "TWO_PART_ANALYSIS",
      difficultyLevel: request.difficultyLevel as "EASY" | "MEDIUM" | "HARD",
      totalMarks: request.totalMarks,
      passingMarks: request.passingMarks,
      timeLimitMinutes: request.timeLimitMinutes ?? undefined,
    },
    { actorUserId: options?.actorUserId },
  );

  // Mark the pool as AI-generated with metadata
  await prisma.assessmentPool.update({
    where: { id: pool.id },
    data: {
      isAiGenerated: true,
      aiGenerationMetadata: {
        prompt: request.prompt,
        questionType: request.questionType,
        difficultyLevel: request.difficultyLevel,
        questionCount: request.questions.length,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  // Record the AI job for audit
  await prisma.aiAssessmentJob.create({
    data: {
      assessmentPoolId: pool.id,
      prompt: request.prompt,
      status: "COMPLETED",
      resultMetadata: {
        questionCount: request.questions.length,
        questionType: request.questionType,
        difficultyLevel: request.difficultyLevel,
      },
      createdById: options?.actorUserId,
      completedAt: new Date(),
    },
  });

  // Insert all generated questions
  for (let i = 0; i < request.questions.length; i++) {
    const question = request.questions[i];
    await addQuestionService({
      assessmentPoolId: pool.id,
      questionText: question.questionText,
      questionType: question.questionType as "MCQ" | "NUMERIC" | "ESSAY" | "FILL_IN_THE_BLANK" | "MULTI_INPUT_REASONING" | "TWO_PART_ANALYSIS",
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      marks: question.marks,
      sortOrder: i,
    });
  }

  return {
    poolId: pool.id,
    questionCount: request.questions.length,
  };
}
