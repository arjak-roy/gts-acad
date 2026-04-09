import "server-only";

import type { ChatCompletionTool } from "openai/resources/chat/completions";

/**
 * OpenAI tool definitions for AI question generation via function calling.
 * Each tool maps to one question type supported by the assessment pool.
 */
export const QUESTION_TOOL_DEFINITIONS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_mcq_question",
      description: "Create a multiple choice question with 4 options and one correct answer.",
      parameters: {
        type: "object",
        properties: {
          questionText: { type: "string", description: "The question text." },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "Option label like A, B, C, D." },
                text: { type: "string", description: "Option body text." },
              },
              required: ["label", "text"],
            },
            description: "Array of { label, text } choices. Usually A, B, C, D.",
          },
          correctAnswer: { type: "string", description: "The label of the correct option (e.g., 'A')." },
          explanation: { type: "string", description: "Why this answer is correct." },
          marks: { type: "number", description: "Points for this question. Default 1." },
        },
        required: ["questionText", "options", "correctAnswer"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_numeric_question",
      description: "Create a numeric answer question with an expected value and optional tolerance.",
      parameters: {
        type: "object",
        properties: {
          questionText: { type: "string", description: "The question text." },
          correctValue: { type: "number", description: "The correct numeric answer." },
          tolerance: { type: "number", description: "Acceptable deviation from the correct value. Default 0." },
          explanation: { type: "string", description: "Why this answer is correct." },
          marks: { type: "number", description: "Points for this question. Default 1." },
        },
        required: ["questionText", "correctValue"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_fill_in_blank_question",
      description: "Create a fill-in-the-blank question with one or more acceptable answers.",
      parameters: {
        type: "object",
        properties: {
          questionText: { type: "string", description: "Use ____ to indicate blank positions." },
          acceptedAnswers: {
            type: "array",
            items: { type: "string" },
            description: "All accepted answers (case-insensitive).",
          },
          explanation: { type: "string", description: "Why this answer is correct." },
          marks: { type: "number", description: "Points for this question. Default 1." },
        },
        required: ["questionText", "acceptedAnswers"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_essay_question",
      description: "Create an essay question that requires manual grading.",
      parameters: {
        type: "object",
        properties: {
          questionText: { type: "string", description: "The essay prompt." },
          rubric: { type: "string", description: "Grading rubric or guidelines." },
          maxWordCount: { type: "number", description: "Suggested word limit." },
          marks: { type: "number", description: "Points for this question. Default 1." },
        },
        required: ["questionText"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_two_part_analysis_question",
      description: "Create a two-part analysis question with a scenario and two selection columns.",
      parameters: {
        type: "object",
        properties: {
          questionText: { type: "string", description: "The scenario or passage to analyze." },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Shared options for both parts.",
          },
          correctPartA: { type: "string", description: "Correct answer for Part A." },
          correctPartB: { type: "string", description: "Correct answer for Part B." },
          explanation: { type: "string", description: "Why these answers are correct." },
          marks: { type: "number", description: "Points for this question. Default 1." },
        },
        required: ["questionText", "options", "correctPartA", "correctPartB"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_multi_input_reasoning_question",
      description: "Create a multi-input reasoning question with a passage and multiple input fields.",
      parameters: {
        type: "object",
        properties: {
          questionText: { type: "string", description: "The passage or scenario." },
          inputFields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "Input field label." },
                expectedAnswer: { type: "string", description: "Expected answer for this field." },
              },
              required: ["label", "expectedAnswer"],
            },
            description: "Array of { label, expectedAnswer } input fields.",
          },
          explanation: { type: "string", description: "Why these answers are correct." },
          marks: { type: "number", description: "Points for this question. Default 1." },
        },
        required: ["questionText", "inputFields"],
      },
    },
  },
];

/** Map of question type enum values to the tool names the model should use. */
export const QUESTION_TYPE_TO_TOOL_NAME: Record<string, string> = {
  MCQ: "create_mcq_question",
  NUMERIC: "create_numeric_question",
  FILL_IN_THE_BLANK: "create_fill_in_blank_question",
  ESSAY: "create_essay_question",
  TWO_PART_ANALYSIS: "create_two_part_analysis_question",
  MULTI_INPUT_REASONING: "create_multi_input_reasoning_question",
};

/** Get only the tool definitions relevant to a specific question type, or all if type is not specified. */
export function getToolsForQuestionType(questionType?: string): ChatCompletionTool[] {
  if (!questionType) {
    return QUESTION_TOOL_DEFINITIONS;
  }

  const toolName = QUESTION_TYPE_TO_TOOL_NAME[questionType];
  if (!toolName) {
    return QUESTION_TOOL_DEFINITIONS;
  }

  return QUESTION_TOOL_DEFINITIONS.filter((tool) => tool.type === "function" && tool.function.name === toolName);
}
