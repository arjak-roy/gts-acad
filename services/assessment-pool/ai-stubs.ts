import "server-only";

/**
 * AI Assessment Generation — Future Scope
 *
 * This module provides stubs for AI-powered assessment creation via tool calling.
 * The intended flow:
 *   1. User provides a prompt describing the assessment they want
 *   2. System calls an AI model with tool definitions for question creation
 *   3. AI generates questions using the defined tool schemas
 *   4. Generated questions are inserted into the assessment pool
 *
 * Tool schemas below define the expected function-calling interface.
 */

/** Tool definition for AI function calling — describes how the model should create questions */
export const AI_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "create_mcq_question",
      description: "Create a multiple choice question with 4 options and one correct answer.",
      parameters: {
        type: "object",
        properties: {
          questionText: { type: "string", description: "The question text." },
          options: {
            type: "array",
            items: { type: "object", properties: { label: { type: "string" }, text: { type: "string" } } },
            description: "Array of { label, text } choices. Usually A, B, C, D.",
          },
          correctAnswer: { type: "string", description: "The label of the correct option (e.g., 'A')." },
          explanation: { type: "string", description: "Why this answer is correct." },
          marks: { type: "number", description: "Points for this question." },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        },
        required: ["questionText", "options", "correctAnswer"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_numeric_question",
      description: "Create a numeric answer question with an expected value and optional tolerance.",
      parameters: {
        type: "object",
        properties: {
          questionText: { type: "string" },
          correctValue: { type: "number", description: "The correct numeric answer." },
          tolerance: { type: "number", description: "Acceptable deviation from the correct value." },
          explanation: { type: "string" },
          marks: { type: "number" },
        },
        required: ["questionText", "correctValue"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_fill_in_blank_question",
      description: "Create a fill-in-the-blank question with one or more acceptable answers.",
      parameters: {
        type: "object",
        properties: {
          questionText: { type: "string", description: "Use ____ to indicate blank positions." },
          acceptedAnswers: { type: "array", items: { type: "string" }, description: "All accepted answers (case-insensitive)." },
          explanation: { type: "string" },
          marks: { type: "number" },
        },
        required: ["questionText", "acceptedAnswers"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_essay_question",
      description: "Create an essay question that requires manual grading.",
      parameters: {
        type: "object",
        properties: {
          questionText: { type: "string" },
          rubric: { type: "string", description: "Grading rubric or guidelines." },
          maxWordCount: { type: "number" },
          marks: { type: "number" },
        },
        required: ["questionText"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_two_part_analysis_question",
      description: "Create a two-part analysis question with a scenario and two selection columns.",
      parameters: {
        type: "object",
        properties: {
          scenario: { type: "string", description: "The scenario or passage to analyze." },
          partALabel: { type: "string", description: "Label for Part A column." },
          partBLabel: { type: "string", description: "Label for Part B column." },
          options: { type: "array", items: { type: "string" }, description: "Shared options for both parts." },
          correctPartA: { type: "string" },
          correctPartB: { type: "string" },
          explanation: { type: "string" },
          marks: { type: "number" },
        },
        required: ["scenario", "options", "correctPartA", "correctPartB"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_multi_input_reasoning_question",
      description: "Create a multi-input reasoning question with a passage and multiple input fields.",
      parameters: {
        type: "object",
        properties: {
          passage: { type: "string", description: "The passage or scenario." },
          inputFields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                expectedAnswer: { type: "string" },
              },
            },
          },
          explanation: { type: "string" },
          marks: { type: "number" },
        },
        required: ["passage", "inputFields"],
      },
    },
  },
];

export type AiGenerateRequest = {
  prompt: string;
  courseId?: string;
  questionType?: string;
  questionCount?: number;
  difficulty?: string;
};

export type AiGenerateResponse = {
  available: false;
  message: string;
  toolDefinitions: typeof AI_TOOL_DEFINITIONS;
};

/**
 * Stub for AI assessment generation. Returns a "Coming Soon" response
 * with the tool definitions that will be used when AI is integrated.
 */
export async function generateAssessmentWithAi(_request: AiGenerateRequest): Promise<AiGenerateResponse> {
  return {
    available: false,
    message:
      "AI-powered assessment generation is coming soon. This feature will use tool calling to automatically create questions based on your prompt, course content, and desired difficulty level.",
    toolDefinitions: AI_TOOL_DEFINITIONS,
  };
}
